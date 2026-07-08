
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RecipeFormData } from '@/lib/schemas';
import { recipeFormSchema } from '@/lib/schemas';
import { suggestRecipeName } from '@/ai/flows/suggest-recipe-name';
import { extractRecipeFromImage } from '@/ai/flows/extract-recipe-from-image-flow.ts';
import type { ExtractRecipeFromImageOutput } from '@/ai/schemas/recipe-extraction-schemas'; // Updated import path
import { extractRecipeFromUrl } from '@/ai/flows/extract-recipe-from-url-flow.ts';
import { extractRecipeFromTiktok } from '@/ai/flows/extract-recipe-from-tiktok-flow.ts';
import { suggestRecipeDetails } from '@/ai/flows/suggest-recipe-details-flow';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Sparkles, Trash2, ArrowUp, ArrowDown, ScanEye, Wand2, UploadCloud, Link2, Video, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import type { Recipe } from '@/lib/types';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface RecipeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipeData: RecipeFormData, recipeIdToUpdate?: string) => Promise<void>;
  recipeToEdit?: Recipe | null;
  isSaving?: boolean;
}

const defaultFormValues: RecipeFormData = {
  title: '',
  ingredients: [{ name: '', quantity: '' }],
  instructions: [''],
  cuisine: '',
  prepTime: '',
  cookTime: '',
  servingSize: '',
};

type ScanMode = "file" | "url" | "tiktok";

interface ScanFile {
  id: string;
  file: File;
  previewUrl: string | null; // data URI for image previews; null for PDFs
}

const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

export function RecipeForm({ isOpen, onClose, onSave, recipeToEdit, isSaving }: RecipeFormProps) {
  const form = useForm<RecipeFormData>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: defaultFormValues,
  });

  const { fields: ingredientFields, append: appendIngredient, remove: removeIngredient } = useFieldArray({
    control: form.control,
    name: 'ingredients',
  });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction, swap: swapInstruction } = useFieldArray({
    control: form.control,
    name: 'instructions',
  });

  const { toast } = useToast();
  const [isSuggestingName, setIsSuggestingName] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');

  const [isSuggestingDetails, setIsSuggestingDetails] = useState(false);
  const [suggestedPrepTime, setSuggestedPrepTime] = useState('');
  const [suggestedCookTime, setSuggestedCookTime] = useState('');
  const [suggestedServingSize, setSuggestedServingSize] = useState('');

  const [isScanDialogVisible, setIsScanDialogVisible] = useState(false);
  const [isScanningRecipe, setIsScanningRecipe] = useState(false);
  const [scanFiles, setScanFiles] = useState<ScanFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanUrl, setScanUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [activeScanTab, setActiveScanTab] = useState<ScanMode>("file");


  const resetSuggestionStates = () => {
    setSuggestedName('');
    setSuggestedPrepTime('');
    setSuggestedCookTime('');
    setSuggestedServingSize('');
  };

  const resetScanInputs = () => {
    setScanFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setScanUrl('');
    setTiktokUrl('');
    // setActiveScanTab("file"); // Optionally reset tab, or let it persist
  };

  useEffect(() => {
    if (isOpen) {
      resetScanInputs();
      resetSuggestionStates();
      setIsScanDialogVisible(false); 

      if (recipeToEdit) {
        const instructionsArray = Array.isArray(recipeToEdit.instructions)
          ? recipeToEdit.instructions
          : typeof recipeToEdit.instructions === 'string' && recipeToEdit.instructions.trim() !== ''
          ? [recipeToEdit.instructions]
          : [''];
        
        let cuisineString = '';
        if (recipeToEdit.cuisines && Array.isArray(recipeToEdit.cuisines)) {
          cuisineString = recipeToEdit.cuisines.join(', ');
        } else if (recipeToEdit.cuisine) { 
          cuisineString = recipeToEdit.cuisine;
        }

        form.reset({
          title: recipeToEdit.title,
          ingredients: recipeToEdit.ingredients.map(ing => ({ 
            id: ing.id || crypto.randomUUID(),
            name: ing.name, 
            quantity: ing.quantity 
          })),
          instructions: instructionsArray.length > 0 ? instructionsArray : [''],
          cuisine: cuisineString,
          prepTime: recipeToEdit.prepTime || '',
          cookTime: recipeToEdit.cookTime || '',
          servingSize: recipeToEdit.servingSize || '',
        });
      } else {
        form.reset(defaultFormValues);
      }
    }
  }, [isOpen, recipeToEdit, form]);

  const onSubmit = async (data: RecipeFormData) => {
    await onSave(data, recipeToEdit?.id);
     if (!form.formState.isSubmitting && form.formState.isSubmitSuccessful) {
        onClose(); 
    }
  };

  const handleSuggestName = async () => {
    const ingredientsValue = form.getValues('ingredients');
    const cuisineValue = form.getValues('cuisine'); 

    if (!ingredientsValue || ingredientsValue.length === 0 || ingredientsValue.every(ing => !ing.name.trim())) {
      toast({
        title: 'Missing Ingredients',
        description: 'Please add some ingredients to suggest a name.',
        variant: 'destructive',
      });
      return;
    }

    setIsSuggestingName(true);
    setSuggestedName('');
    try {
      const ingredientsString = ingredientsValue.map(ing => ing.name).filter(name => name.trim()).join(', ');
      if (!ingredientsString) {
        toast({
            title: 'Missing Ingredients',
            description: 'Please ensure ingredients have names.',
            variant: 'destructive',
        });
        setIsSuggestingName(false);
        return;
      }
      const result = await suggestRecipeName({ ingredients: ingredientsString, cuisine: cuisineValue || '' });
      setSuggestedName(result.recipeName);
      toast({
        title: 'Name Suggested!',
        description: `How about "${result.recipeName}"?`,
      });
    } catch (error) {
      console.error('Error suggesting recipe name:', error);
      toast({
        title: 'Suggestion Error',
        description: 'Failed to suggest a name. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSuggestingName(false);
    }
  };

  const handleUseSuggestedName = () => {
    if (suggestedName) {
      form.setValue('title', suggestedName);
      setSuggestedName(''); 
    }
  };

  const handleSuggestDetails = async () => {
    const title = form.getValues('title');
    const ingredientsValue = form.getValues('ingredients');
    const instructionsValue = form.getValues('instructions');

    if (!title.trim()) {
      toast({ title: 'Missing Title', description: 'Please provide a title for the recipe.', variant: 'destructive' });
      return;
    }
    if (!ingredientsValue || ingredientsValue.length === 0 || ingredientsValue.every(ing => !ing.name.trim())) {
      toast({ title: 'Missing Ingredients', description: 'Please add some ingredients to suggest details.', variant: 'destructive' });
      return;
    }
    if (!instructionsValue || instructionsValue.length === 0 || instructionsValue.every(step => !step.trim())) {
      toast({ title: 'Missing Instructions', description: 'Please add some instructions to suggest details.', variant: 'destructive' });
      return;
    }

    setIsSuggestingDetails(true);
    setSuggestedPrepTime('');
    setSuggestedCookTime('');
    setSuggestedServingSize('');

    try {
      const ingredientsString = ingredientsValue.map(ing => ing.name).filter(name => name.trim()).join(', ');
      const instructionsString = instructionsValue.filter(step => step.trim()).join('\n');

      if (!ingredientsString) {
        toast({ title: 'Missing Ingredients', description: 'Please ensure ingredients have names.', variant: 'destructive'});
        setIsSuggestingDetails(false);
        return;
      }
      if (!instructionsString) {
         toast({ title: 'Missing Instructions', description: 'Please ensure instructions are not empty.', variant: 'destructive'});
        setIsSuggestingDetails(false);
        return;
      }

      const result = await suggestRecipeDetails({ title, ingredients: ingredientsString, instructions: instructionsString });
      
      setSuggestedPrepTime(result.suggestedPrepTime);
      setSuggestedCookTime(result.suggestedCookTime);
      setSuggestedServingSize(result.suggestedServingSize);

      toast({
        title: 'Details Suggested!',
        description: 'AI has provided suggestions for prep time, cook time, and serving size.',
      });
    } catch (error) {
      console.error('Error suggesting recipe details:', error);
      toast({
        title: 'Suggestion Error',
        description: 'Failed to suggest recipe details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSuggestingDetails(false);
    }
  };

  const handleUseSuggestedPrepTime = () => {
    if (suggestedPrepTime) form.setValue('prepTime', suggestedPrepTime);
    setSuggestedPrepTime('');
  };
  const handleUseSuggestedCookTime = () => {
    if (suggestedCookTime) form.setValue('cookTime', suggestedCookTime);
    setSuggestedCookTime('');
  };
  const handleUseSuggestedServingSize = () => {
    if (suggestedServingSize) form.setValue('servingSize', suggestedServingSize);
    setSuggestedServingSize('');
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Reset the input so picking the same file again (or adding more) still fires onChange.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (files.length === 0) return;

    files.forEach((file) => {
      const id = crypto.randomUUID();
      // Add the file immediately; fill in the image preview asynchronously.
      setScanFiles((prev) => [...prev, { id, file, previewUrl: null }]);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setScanFiles((prev) =>
            prev.map((sf) => (sf.id === id ? { ...sf, previewUrl: reader.result as string } : sf))
          );
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleRemoveScanFile = (id: string) => {
    setScanFiles((prev) => prev.filter((sf) => sf.id !== id));
  };
  
  const populateFormWithScannedData = (extractedData: ExtractRecipeFromImageOutput) => {
    form.reset({ 
      title: extractedData.title || '',
      ingredients: (extractedData.ingredients && extractedData.ingredients.length > 0 ? extractedData.ingredients : [{ id: crypto.randomUUID(), name: '', quantity: '' }]).map(ing => ({
        id: ing.id || crypto.randomUUID(), 
        name: ing.name || '',
        quantity: ing.quantity || '',
      })),
      instructions: extractedData.instructions && extractedData.instructions.length > 0 ? extractedData.instructions : [''],
      cuisine: extractedData.cuisine || '',
      prepTime: extractedData.prepTime || '',
      cookTime: extractedData.cookTime || '',
      servingSize: extractedData.servingSize || '',
    });

    toast({
      title: 'Recipe Scanned!',
      description: 'Recipe details have been pre-filled. Please review and edit as needed.',
    });
    setIsScanDialogVisible(false); 
    resetScanInputs();
  }

  const handleScanData = async () => {
    setIsScanningRecipe(true);
    try {
      if (activeScanTab === "file") {
        if (scanFiles.length === 0) {
          toast({ title: 'No Files Selected', description: 'Please select one or more images or PDFs to scan.', variant: 'destructive' });
          return;
        }

        let fileDataUris: string[];
        try {
          fileDataUris = await Promise.all(scanFiles.map((sf) => fileToDataUri(sf.file)));
        } catch (readError) {
          console.error('Error reading files:', readError);
          toast({ title: 'File Read Error', description: 'Could not read one of the selected files.', variant: 'destructive' });
          return;
        }

        const extractedData = await extractRecipeFromImage({ fileDataUris });
        populateFormWithScannedData(extractedData);

      } else if (activeScanTab === "url") {
        if (!scanUrl.trim() || !URL.canParse(scanUrl)) { // Basic URL validation
          toast({ title: 'Invalid URL', description: 'Please enter a valid URL to scan.', variant: 'destructive' });
          return;
        }
        const extractedData = await extractRecipeFromUrl({ recipeUrl: scanUrl });
        populateFormWithScannedData(extractedData);

      } else if (activeScanTab === "tiktok") {
        if (!tiktokUrl.trim() || !URL.canParse(tiktokUrl)) {
          toast({ title: 'Invalid Link', description: 'Please paste a valid TikTok video link.', variant: 'destructive' });
          return;
        }
        if (!/tiktok\.com/i.test(tiktokUrl)) {
          toast({ title: 'Not a TikTok Link', description: 'This does not look like a TikTok URL. Please paste a link from tiktok.com.', variant: 'destructive' });
          return;
        }
        const extractedData = await extractRecipeFromTiktok({ videoUrl: tiktokUrl });
        populateFormWithScannedData(extractedData);
      }
    } catch (aiError) {
      console.error('Error scanning recipe (AI processing):', aiError);
      toast({ title: 'Scanning Error', description: aiError instanceof Error ? aiError.message : 'Failed to extract the recipe. Please try again.', variant: 'destructive' });
    } finally {
      setIsScanningRecipe(false);
    }
  };
  
  const handleCloseMainDialog = () => {
    if (isSaving) return; 
    resetScanInputs();
    resetSuggestionStates();
    setIsScanDialogVisible(false);
    onClose(); 
  }

  const handleCloseScanDialog = () => {
    if (isScanningRecipe) return; 
    resetScanInputs();
    setIsScanDialogVisible(false);
  }

  const commonDisabledProps = isSaving || isSuggestingName || isScanningRecipe || isScanDialogVisible || isSuggestingDetails;
  const isScanButtonDisabled =
    activeScanTab === 'file'
      ? scanFiles.length === 0
      : activeScanTab === 'url'
      ? !scanUrl.trim()
      : !tiktokUrl.trim();


  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { handleCloseMainDialog(); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">
              {recipeToEdit ? 'Edit Recipe' : 'Add New Recipe'}
            </DialogTitle>
            <DialogDescription>
              {recipeToEdit ? 'Update the details of your recipe.' : 'Fill in the details for your new culinary creation.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <fieldset disabled={isSaving || isScanningRecipe || isSuggestingDetails} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Grandma's Apple Pie" {...field} className="text-base py-2 px-3" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      onClick={handleSuggestName}
                      disabled={commonDisabledProps}
                      variant="default" 
                      className="w-full sm:w-auto"
                    >
                      {isSuggestingName ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Suggest Title
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsScanDialogVisible(true)}
                      disabled={commonDisabledProps}
                      variant="default" 
                      className="w-full sm:w-auto"
                    >
                      <ScanEye className="mr-2 h-4 w-4" />
                      Scan Recipe
                    </Button>
                  </div>
                  {suggestedName && (
                    <div className="p-3 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between">
                      <p className="text-sm">Suggested: <span className="font-semibold">{suggestedName}</span></p>
                      <Button type="button" size="sm" onClick={handleUseSuggestedName} variant="default" disabled={commonDisabledProps}>Use this name</Button>
                    </div>
                  )}
                </div>
                
                <FormField
                  control={form.control}
                  name="cuisine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Cuisine Tags (comma-separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Italian, Quick, Spicy" {...field} className="text-base py-2 px-3"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-1 my-4">
                   <Button
                        type="button"
                        onClick={handleSuggestDetails}
                        disabled={commonDisabledProps}
                        variant="default"
                        className="w-full sm:w-auto"
                    >
                        {isSuggestingDetails ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Suggest Times & Servings
                    </Button>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="prepTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Prep Time</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 20 mins" {...field} className="text-base py-2 px-3"/>
                        </FormControl>
                        {suggestedPrepTime && (
                          <div className="p-2 mt-1 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between text-xs">
                            <span>Suggest: {suggestedPrepTime}</span>
                            <Button type="button" size="xs" onClick={handleUseSuggestedPrepTime} variant="outline" className="py-0.5 px-1.5 h-auto" disabled={commonDisabledProps}>Use</Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cookTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Cook Time</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 45 mins" {...field} className="text-base py-2 px-3"/>
                        </FormControl>
                        {suggestedCookTime && (
                          <div className="p-2 mt-1 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between text-xs">
                            <span>Suggest: {suggestedCookTime}</span>
                            <Button type="button" size="xs" onClick={handleUseSuggestedCookTime} variant="outline" className="py-0.5 px-1.5 h-auto" disabled={commonDisabledProps}>Use</Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="servingSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Serving Size</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 4 servings" {...field} className="text-base py-2 px-3"/>
                        </FormControl>
                        {suggestedServingSize && (
                          <div className="p-2 mt-1 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between text-xs">
                            <span>Suggest: {suggestedServingSize}</span>
                            <Button type="button" size="xs" onClick={handleUseSuggestedServingSize} variant="outline" className="py-0.5 px-1.5 h-auto" disabled={commonDisabledProps}>Use</Button>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormLabel className="text-base">Ingredients</FormLabel>
                  {ingredientFields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 mt-2 mb-3 p-3 border rounded-md bg-secondary/30">
                      <FormField
                        control={form.control}
                        name={`ingredients.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-grow">
                            <FormLabel className="text-sm sr-only">Ingredient Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Ingredient Name" {...field} className="text-sm py-1.5 px-2"/>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ingredients.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem className="w-1/3">
                             <FormLabel className="text-sm sr-only">Quantity</FormLabel>
                            <FormControl>
                              <Input placeholder="Quantity (e.g., 2 cups)" {...field} className="text-sm py-1.5 px-2"/>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name={`ingredients.${index}.id`}
                        render={({ field }) => <input type="hidden" {...field} />}
                      />
                      <Button
                        type="button"
                        variant="ghost" 
                        size="icon"
                        onClick={() => removeIngredient(index)}
                        className="text-muted-foreground hover:text-destructive" 
                        aria-label="Remove ingredient"
                        disabled={commonDisabledProps}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => appendIngredient({ id: crypto.randomUUID(), name: '', quantity: '' })}
                    className="mt-2"
                    disabled={commonDisabledProps}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
                  </Button>
                </div>
                
                <div>
                  <FormLabel className="text-base">Instructions</FormLabel>
                  {instructionFields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2 mt-2 mb-3 p-3 border rounded-md bg-secondary/30">
                      <FormField
                        control={form.control}
                        name={`instructions.${index}`}
                        render={({ field: instructionField }) => ( 
                          <FormItem className="flex-grow">
                            <FormLabel className="text-sm sr-only">Instruction Step {index + 1}</FormLabel>
                            <FormControl>
                              <Textarea placeholder={`Step ${index + 1}...`} {...instructionField} rows={3} className="text-base py-2 px-3 resize-none" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex flex-col gap-1 mt-1">
                        <Button
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => swapInstruction(index, index - 1)}
                          disabled={index === 0 || commonDisabledProps}
                          className="text-muted-foreground hover:text-primary h-7 w-7"
                          aria-label={`Move instruction step ${index + 1} up`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => removeInstruction(index)}
                          className="text-muted-foreground hover:text-destructive h-7 w-7" 
                          aria-label={`Remove instruction step ${index + 1}`}
                          disabled={commonDisabledProps}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                         <Button
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => swapInstruction(index, index + 1)}
                          disabled={index === instructionFields.length - 1 || commonDisabledProps}
                          className="text-muted-foreground hover:text-primary h-7 w-7"
                          aria-label={`Move instruction step ${index + 1} down`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={() => appendInstruction('')}
                    className="mt-2"
                    disabled={commonDisabledProps}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Instruction Step
                  </Button>
                  <FormMessage>{form.formState.errors.instructions?.message || form.formState.errors.instructions?.root?.message}</FormMessage>
                </div>
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="default" onClick={handleCloseMainDialog} className="w-full sm:w-auto" disabled={isSaving || isScanningRecipe}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" className="w-full sm:w-auto mb-3 sm:mb-0" disabled={commonDisabledProps}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : recipeToEdit ? 'Save Changes' : 'Save Recipe'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Scan Data Dialog */}
      <Dialog open={isScanDialogVisible} onOpenChange={(open) => { if (!open) { handleCloseScanDialog(); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Scan Recipe Data</DialogTitle>
            <DialogDescription>
              Upload one or more images/PDFs, enter a web URL, or paste a TikTok link. The AI will attempt to extract details.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeScanTab} onValueChange={(value) => setActiveScanTab(value as ScanMode)} className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="file"><UploadCloud className="mr-2 h-4 w-4"/>From Files</TabsTrigger>
              <TabsTrigger value="url"><Link2 className="mr-2 h-4 w-4"/>From URL</TabsTrigger>
              <TabsTrigger value="tiktok"><Video className="mr-2 h-4 w-4"/>From TikTok</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="space-y-4 py-4">
              <div>
                <Label htmlFor="recipe-file-upload-modal" className="text-sm font-medium">Upload Images or PDFs</Label>
                <Input
                  id="recipe-file-upload-modal"
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="mt-1 text-sm"
                  disabled={isScanningRecipe}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Add multiple photos/pages of the same recipe (e.g. one for ingredients, one for steps).
                </p>
                {scanFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {scanFiles.map((sf) => (
                      <div key={sf.id} className="relative rounded-md overflow-hidden border bg-secondary/30">
                        <button
                          type="button"
                          onClick={() => handleRemoveScanFile(sf.id)}
                          disabled={isScanningRecipe}
                          aria-label={`Remove ${sf.file.name}`}
                          className="absolute top-1 right-1 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {sf.previewUrl ? (
                          <div className="relative w-full aspect-video">
                            <Image src={sf.previewUrl} alt={sf.file.name} layout="fill" objectFit="contain" data-ai-hint="food cooking" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-full aspect-video p-2 text-center text-xs text-muted-foreground">
                            {sf.file.type === 'application/pdf' ? 'PDF' : 'File'}: {sf.file.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="url" className="space-y-4 py-4">
              <div>
                <Label htmlFor="recipe-url-input-modal" className="text-sm font-medium">Recipe Web Page URL</Label>
                <Input
                  id="recipe-url-input-modal"
                  type="url"
                  placeholder="https://www.example.com/your-recipe"
                  value={scanUrl}
                  onChange={(e) => setScanUrl(e.target.value)}
                  className="mt-1 text-sm"
                  disabled={isScanningRecipe}
                />
              </div>
            </TabsContent>
            <TabsContent value="tiktok" className="space-y-4 py-4">
              <div>
                <Label htmlFor="recipe-tiktok-input-modal" className="text-sm font-medium">TikTok Video Link</Label>
                <Input
                  id="recipe-tiktok-input-modal"
                  type="url"
                  placeholder="https://www.tiktok.com/@creator/video/123..."
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  className="mt-1 text-sm"
                  disabled={isScanningRecipe}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  We read the recipe from the video's caption, so it works best when the creator writes the recipe there.
                </p>
              </div>
            </TabsContent>
          </Tabs>
            <p className="text-xs text-muted-foreground pt-0">
              The AI will pre-fill the recipe form with the extracted information. Review and edit before saving.
              PDF, URL, and TikTok scanning effectiveness may vary.
            </p>
          <DialogFooter>
            <Button type="button" variant="default" onClick={handleCloseScanDialog} className="w-full sm:w-auto" disabled={isScanningRecipe}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleScanData}
              className="w-full sm:w-auto mb-3 sm:mb-0"
              disabled={isScanButtonDisabled || isScanningRecipe}
            >
              {isScanningRecipe ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanEye className="mr-2 h-4 w-4" />
              )}
              Scan & Use Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

