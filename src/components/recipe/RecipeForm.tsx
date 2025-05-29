
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Sparkles, Trash2, ArrowUp, ArrowDown, UploadCloud, ScanEye } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import type { Recipe } from '@/lib/types';
import Image from 'next/image';
import { Label } from '@/components/ui/label';

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

  const [isScanDialogValidOpen, setIsScanDialogValidOpen] = useState(false);
  const [isScanningRecipe, setIsScanningRecipe] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetScanImageState = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      resetScanImageState();
      setIsScanDialogValidOpen(false); // Ensure scan dialog is closed when main form opens

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
        setSuggestedName('');
      } else {
        form.reset(defaultFormValues);
        setSuggestedName('');
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
    }
  };

  const handleScanRecipeImage = async () => {
    if (!selectedImageFile || !selectedImagePreview) {
      toast({
        title: 'No Image Selected',
        description: 'Please select an image file to scan.',
        variant: 'destructive',
      });
      return;
    }

    setIsScanningRecipe(true);
    try {
      const imageDataUri = selectedImagePreview; 
      const extractedData = await extractRecipeFromImage({ imageDataUri });

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
      setIsScanDialogValidOpen(false); // Close scan dialog on success
      resetScanImageState(); // Clear image selection
    } catch (error) {
      console.error('Error scanning recipe image:', error);
      toast({
        title: 'Scanning Error',
        description: 'Failed to extract recipe from image. Please try again or enter manually.',
        variant: 'destructive',
      });
    } finally {
      setIsScanningRecipe(false);
    }
  };
  
  const handleCloseMainDialog = () => {
    if (isSaving) return; // Prevent closing if main form is saving
    resetScanImageState();
    setIsScanDialogValidOpen(false);
    onClose(); 
  }

  const handleCloseScanDialog = () => {
    if (isScanningRecipe) return; // Prevent closing if scan is in progress
    resetScanImageState();
    setIsScanDialogValidOpen(false);
  }

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
              <fieldset disabled={isSaving || isScanningRecipe} className="space-y-6">
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
                      disabled={isSuggestingName || isSaving || isScanningRecipe || isScanDialogValidOpen}
                      variant="default" 
                      className="w-full sm:w-auto"
                    >
                      {isSuggestingName ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Suggest Title with AI
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setIsScanDialogValidOpen(true)}
                      disabled={isSaving || isSuggestingName || isScanningRecipe || isScanDialogValidOpen}
                      variant="default" 
                      className="w-full sm:w-auto"
                    >
                      <ScanEye className="mr-2 h-4 w-4" />
                      Scan Recipe from Image
                    </Button>
                  </div>
                  {suggestedName && (
                    <div className="p-3 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between">
                      <p className="text-sm">Suggested: <span className="font-semibold">{suggestedName}</span></p>
                      <Button type="button" size="sm" onClick={handleUseSuggestedName} variant="default" disabled={isSaving || isSuggestingName || isScanningRecipe || isScanDialogValidOpen}>Use this name</Button>
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
                        disabled={isSaving || isScanningRecipe || isScanDialogValidOpen}
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
                    disabled={isSaving || isScanningRecipe || isScanDialogValidOpen}
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
                          disabled={index === 0 || !!isSaving || !!isScanningRecipe || isScanDialogValidOpen}
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
                          disabled={isSaving || isScanningRecipe || isScanDialogValidOpen}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                         <Button
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => swapInstruction(index, index + 1)}
                          disabled={index === instructionFields.length - 1 || !!isSaving || !!isScanningRecipe || isScanDialogValidOpen}
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
                    disabled={isSaving || isScanningRecipe || isScanDialogValidOpen}
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
                <Button type="submit" variant="default" className="w-full sm:w-auto mb-3 sm:mb-0" disabled={isSaving || isSuggestingName || isScanningRecipe || isScanDialogValidOpen}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : recipeToEdit ? 'Save Changes' : 'Save Recipe'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Scan Image Dialog */}
      <Dialog open={isScanDialogValidOpen} onOpenChange={(open) => { if (!open) { handleCloseScanDialog(); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Scan Recipe from Image</DialogTitle>
            <DialogDescription>
              Upload an image of a recipe. The AI will attempt to extract the details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="recipe-image-upload-modal" className="text-sm font-medium">Upload Image</Label>
              <Input
                id="recipe-image-upload-modal"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                ref={fileInputRef}
                className="mt-1 text-sm"
                disabled={isScanningRecipe}
              />
              {selectedImagePreview && (
                <div className="mt-3 relative w-full aspect-video rounded-md overflow-hidden border">
                  <Image src={selectedImagePreview} alt="Recipe preview" layout="fill" objectFit="contain" data-ai-hint="food cooking" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The AI will pre-fill the recipe form with the extracted information. You can review and edit it before saving.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="default" onClick={handleCloseScanDialog} className="w-full sm:w-auto" disabled={isScanningRecipe}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleScanRecipeImage}
              className="w-full sm:w-auto mb-3 sm:mb-0"
              disabled={!selectedImageFile || isScanningRecipe}
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

