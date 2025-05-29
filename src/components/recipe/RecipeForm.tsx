
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Recipe } from '@/lib/types';

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
  cuisine: '', // Will hold comma-separated tags
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

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } = useFieldArray({
    control: form.control,
    name: 'instructions',
  });

  const { toast } = useToast();
  const [isSuggestingName, setIsSuggestingName] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (recipeToEdit) {
        const instructionsArray = Array.isArray(recipeToEdit.instructions)
          ? recipeToEdit.instructions
          : typeof recipeToEdit.instructions === 'string' && recipeToEdit.instructions.trim() !== ''
          ? [recipeToEdit.instructions]
          : [''];
        
        // Handle new cuisines array or fallback to old cuisine string for pre-fill
        let cuisineString = '';
        if (recipeToEdit.cuisines && Array.isArray(recipeToEdit.cuisines)) {
          cuisineString = recipeToEdit.cuisines.join(', ');
        } else if (recipeToEdit.cuisine) { // Fallback for old data model
          cuisineString = recipeToEdit.cuisine;
        }

        form.reset({
          title: recipeToEdit.title,
          ingredients: recipeToEdit.ingredients.map(ing => ({ 
            id: ing.id, 
            name: ing.name, 
            quantity: ing.quantity 
          })),
          instructions: instructionsArray.length > 0 ? instructionsArray : [''],
          cuisine: cuisineString,
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
    const cuisineValue = form.getValues('cuisine'); // This is now a comma-separated string of tags

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
      // Pass the comma-separated cuisine string to the AI flow
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
  }

  const handleCloseDialog = () => {
    if (isSaving) return;
    onClose(); 
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { handleCloseDialog(); } }}>
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
            <fieldset disabled={isSaving} className="space-y-6">
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
               <Button
                type="button"
                onClick={handleSuggestName}
                disabled={isSuggestingName || isSaving}
                variant="outline"
                className="w-full"
              >
                {isSuggestingName ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Suggest Recipe Title with AI
              </Button>
              
              {suggestedName && (
                <div className="p-3 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between">
                  <p className="text-sm">Suggested: <span className="font-semibold">{suggestedName}</span></p>
                  <Button type="button" size="sm" onClick={handleUseSuggestedName} disabled={isSaving || isSuggestingName}>Use this name</Button>
                </div>
              )}

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
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendIngredient({ name: '', quantity: '' })}
                  className="mt-2"
                  disabled={isSaving}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
                </Button>
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
              
              <div>
                <FormLabel className="text-base">Instructions</FormLabel>
                {instructionFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2 mt-2 mb-3 p-3 border rounded-md bg-secondary/30">
                    <FormField
                      control={form.control}
                      name={`instructions.${index}`}
                      render={({ field }) => (
                        <FormItem className="flex-grow">
                          <FormLabel className="text-sm sr-only">Instruction Step {index + 1}</FormLabel>
                          <FormControl>
                            <Textarea placeholder={`Step ${index + 1}...`} {...field} rows={3} className="text-base py-2 px-3 resize-none" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInstruction(index)}
                      className="text-muted-foreground hover:text-destructive mt-1" 
                      aria-label={`Remove instruction step ${index + 1}`}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendInstruction('')}
                  className="mt-2"
                  disabled={isSaving}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Instruction Step
                </Button>
                <FormMessage>{form.formState.errors.instructions?.message || form.formState.errors.instructions?.root?.message}</FormMessage>
              </div>
            </fieldset>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="mr-2" disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || isSuggestingName}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : recipeToEdit ? 'Save Changes' : 'Save Recipe'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
