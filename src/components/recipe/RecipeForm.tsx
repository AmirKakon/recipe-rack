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
import { useState } from 'react';

interface RecipeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipeData: RecipeFormData) => void;
}

export function RecipeForm({ isOpen, onClose, onSave }: RecipeFormProps) {
  const form = useForm<RecipeFormData>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      title: '',
      ingredients: [{ name: '', quantity: '' }],
      instructions: [''], // Default to one empty instruction step
      cuisine: '',
    },
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

  const onSubmit = (data: RecipeFormData) => {
    onSave(data);
    form.reset();
    setSuggestedName('');
    onClose();
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
      setSuggestedName(''); // Clear suggestion after use
    }
  }

  const handleCloseDialog = () => {
    onClose();
    form.reset({
        title: '',
        ingredients: [{ name: '', quantity: '' }],
        instructions: [''],
        cuisine: '',
    });
    setSuggestedName('');
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { handleCloseDialog(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-6 rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Add New Recipe</DialogTitle>
          <DialogDescription>Fill in the details for your new culinary creation.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
            {suggestedName && (
              <div className="p-3 bg-accent/10 border border-accent/30 rounded-md flex items-center justify-between">
                <p className="text-sm">Suggested: <span className="font-semibold">{suggestedName}</span></p>
                <Button type="button" size="sm" onClick={handleUseSuggestedName}>Use this name</Button>
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(index)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove ingredient"
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
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
              </Button>
            </div>

            <FormField
              control={form.control}
              name="cuisine"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Cuisine (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Italian, Mexican" {...field} className="text-base py-2 px-3"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="button"
              onClick={handleSuggestName}
              disabled={isSuggestingName}
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
                    className="text-muted-foreground hover:text-destructive mt-1" // Adjusted margin for alignment with textarea
                    aria-label={`Remove instruction step ${index + 1}`}
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
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Instruction Step
              </Button>
               {/* General error message for the instructions array itself (e.g. if it's empty) */}
              <FormMessage>{form.formState.errors.instructions?.message || form.formState.errors.instructions?.root?.message}</FormMessage>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="mr-2">
                Cancel
              </Button>
              <Button type="submit">Save Recipe</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
