// meal_planner_frontend/web/src/pages/ExampleMealPlansPage.jsx
import React from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  CardHeader,
  CardMedia,
  List,
  ListItem,
  ListItemText,
  Paper
} from '@mui/material';

// A map from title -> Hardcoded image URL
// Replace these with your own curated images.
const mealImageMap = {
  'High-Protein Veggie Omelet':
    'https://plus.unsplash.com/premium_photo-1667807521536-bc35c8d8b64b?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Lemon Garlic Chicken Salad':
    'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?ixlib=rb-4.0.3&auto=format&w=800&q=80',
  'Baked Salmon with Broccoli':
    'https://images.unsplash.com/photo-1656389863625-59de2275fb7e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Greek Yogurt with Berries':
    'https://images.unsplash.com/photo-1622031178104-3f1af1537ae8?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Protein-Packed Oatmeal':
    'https://images.unsplash.com/photo-1571750007475-09cc42b58613?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Turkey Lettuce Wraps':
    'https://images.unsplash.com/photo-1542128722-d6fe34923abc?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Baked Cod with Asparagus':
    'https://images.unsplash.com/photo-1611507775040-6af3f6a18656?q=80&w=1918&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  'Mixed Nuts & Apple Slices':
    'https://images.unsplash.com/photo-1603199477330-8e324b8b7e13?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
};

// A fallback image if the title is not in the dictionary
const defaultImage =
  'https://images.unsplash.com/photo-1633281421726-33f1942da89c?ixlib=rb-4.0.3&auto=format&w=800&q=80';

// Helper: capitalizes the meal_time
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Sample day data
const sampleMealPlans = {
  days: [
    {
      dayNumber: 1,
      meals: [
        {
          meal_time: 'breakfast',
          title: 'High-Protein Veggie Omelet',
          ingredients: [
            '1 cup egg whites',
            '1/2 cup spinach',
            '1/4 cup diced mushrooms',
            '1/4 cup diced onions',
            'Salt and pepper to taste'
          ],
          instructions: 'Sauté onions and mushrooms, then add egg whites and spinach. Cook until set.',
          servings: 2,
          macros: {
            perServing: {
              calories: 200,
              protein: '25g',
              carbs: '5g',
              fat: '6g'
            },
            perMeal: {
              calories: 400,
              protein: '50g',
              carbs: '10g',
              fat: '12g'
            }
          }
        },
        {
          meal_time: 'lunch',
          title: 'Lemon Garlic Chicken Salad',
          ingredients: [
            '1 chicken breast (6 oz)',
            '4 cups mixed greens',
            '1/2 cup cherry tomatoes',
            '1/4 cup sliced cucumbers',
            '2 tbsp lemon juice',
            '1 tbsp olive oil',
            'Salt and pepper to taste'
          ],
          instructions: 'Grill chicken with lemon juice, olive oil, salt, and pepper. Slice and serve over greens with tomatoes and cucumbers.',
          servings: 2,
          macros: {
            perServing: {
              calories: 300,
              protein: '30g',
              carbs: '8g',
              fat: '10g'
            },
            perMeal: {
              calories: 600,
              protein: '60g',
              carbs: '16g',
              fat: '20g'
            }
          }
        },
        {
          meal_time: 'dinner',
          title: 'Baked Salmon with Broccoli',
          ingredients: [
            '2 salmon fillets (6 oz each)',
            '2 cups broccoli florets',
            '1 tbsp olive oil',
            '1 tsp dried dill',
            'Salt and pepper to taste'
          ],
          instructions: 'Preheat oven to 400°F. Season salmon with dill, salt, pepper, and olive oil. Place broccoli around salmon and bake for 15-18 minutes.',
          servings: 2,
          macros: {
            perServing: {
              calories: 350,
              protein: '35g',
              carbs: '6g',
              fat: '18g'
            },
            perMeal: {
              calories: 700,
              protein: '70g',
              carbs: '12g',
              fat: '36g'
            }
          }
        }
      ],
      snacks: [
        {
          title: 'Greek Yogurt with Berries',
          ingredients: ['1 cup Greek yogurt', '1/2 cup mixed berries'],
          instructions: 'Combine yogurt and berries. Enjoy chilled.',
          servings: 2,
          macros: {
            perServing: {
              calories: 150,
              protein: '15g',
              carbs: '15g',
              fat: '3g'
            },
            perMeal: {
              calories: 300,
              protein: '30g',
              carbs: '30g',
              fat: '6g'
            }
          }
        }
      ]
    },
    {
      dayNumber: 2,
      meals: [
        {
          meal_time: 'breakfast',
          title: 'Protein-Packed Oatmeal',
          ingredients: [
            '1/2 cup oats',
            '1 scoop protein powder',
            '1 cup almond milk',
            '1/4 cup diced strawberries'
          ],
          instructions: 'Cook oats in almond milk. Stir in protein powder and top with strawberries.',
          servings: 2,
          macros: {
            perServing: {
              calories: 250,
              protein: '25g',
              carbs: '35g',
              fat: '5g'
            },
            perMeal: {
              calories: 500,
              protein: '50g',
              carbs: '70g',
              fat: '10g'
            }
          }
        },
        {
          meal_time: 'lunch',
          title: 'Turkey Lettuce Wraps',
          ingredients: [
            '8 oz ground turkey',
            '1/4 cup diced onions',
            '1/2 cup diced bell peppers',
            '4 lettuce leaves',
            'Salt, pepper, garlic powder to taste'
          ],
          instructions: 'Sauté turkey with onions, peppers, and seasonings. Place mixture in lettuce leaves.',
          servings: 2,
          macros: {
            perServing: {
              calories: 300,
              protein: '30g',
              carbs: '10g',
              fat: '15g'
            },
            perMeal: {
              calories: 600,
              protein: '60g',
              carbs: '20g',
              fat: '30g'
            }
          }
        },
        {
          meal_time: 'dinner',
          title: 'Baked Cod with Asparagus',
          ingredients: [
            '2 cod fillets (6 oz each)',
            '1 lb asparagus',
            '1 tbsp olive oil',
            '1 tsp dried basil',
            'Salt and pepper to taste'
          ],
          instructions: 'Season cod with olive oil, basil, salt, and pepper. Bake at 400°F for 15-20 minutes. Roast asparagus for 10-12 minutes alongside.',
          servings: 2,
          macros: {
            perServing: {
              calories: 320,
              protein: '35g',
              carbs: '5g',
              fat: '14g'
            },
            perMeal: {
              calories: 640,
              protein: '70g',
              carbs: '10g',
              fat: '28g'
            }
          }
        }
      ],
      snacks: [
        {
          title: 'Mixed Nuts & Apple Slices',
          ingredients: ['1/4 cup almonds', '1 apple, sliced'],
          instructions: 'Enjoy as a simple snack. Optional peanut butter for dipping.',
          servings: 2,
          macros: {
            perServing: {
              calories: 200,
              protein: '6g',
              carbs: '22g',
              fat: '12g'
            },
            perMeal: {
              calories: 400,
              protein: '12g',
              carbs: '44g',
              fat: '24g'
            }
          }
        }
      ]
    }
  ]
};

const ExampleMealPlansPage = () => {
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        Example Meal Plans
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Here are a couple of sample meal plans that follow our AI-generated meal plan structure.
        Each plan includes macros per serving, detailed ingredients, and instructions. 
        This showcases what your custom generated plan might look like!
      </Typography>

      {sampleMealPlans.days.map((day) => (
        <Paper key={day.dayNumber} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h5" gutterBottom>
            Day {day.dayNumber}
          </Typography>

          {/* Meals */}
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Meals
          </Typography>
          {day.meals.map((meal, idx) => {
            // Hard-coded image from dictionary, fallback if not found
            const imageUrl = mealImageMap[meal.title] || defaultImage;

            return (
              <Card key={idx} variant="outlined" sx={{ my: 1 }}>
                <CardHeader
                  title={`${capitalize(meal.meal_time)}: ${meal.title}`}
                  subheader={`Servings: ${meal.servings}`}
                />
                <CardMedia
                  component="img"
                  height="180"
                  image={imageUrl}
                  alt={meal.title}
                />
                <CardContent>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Ingredients:
                  </Typography>
                  <List>
                    {meal.ingredients.map((ing, i) => (
                      <ListItem key={i} sx={{ py: 0 }}>
                        <ListItemText primary={ing} />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Instructions:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {meal.instructions}
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Macros (per serving):
                  </Typography>
                  <Typography variant="body2">
                    {`Calories: ${meal.macros.perServing.calories}, Protein: ${meal.macros.perServing.protein}, Carbs: ${meal.macros.perServing.carbs}, Fat: ${meal.macros.perServing.fat}`}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}

          {/* Snacks */}
          <Typography variant="subtitle1" sx={{ mt: 3 }}>
            Snacks
          </Typography>
          {day.snacks.map((snack, idx) => {
            const imageUrl = mealImageMap[snack.title] || defaultImage;

            return (
              <Card key={idx} variant="outlined" sx={{ my: 1 }}>
                <CardHeader
                  title={`Snack: ${snack.title}`}
                  subheader={`Servings: ${snack.servings}`}
                />
                <CardMedia
                  component="img"
                  height="180"
                  image={imageUrl}
                  alt={snack.title}
                />
                <CardContent>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Ingredients:
                  </Typography>
                  <List>
                    {snack.ingredients.map((ing, i) => (
                      <ListItem key={i} sx={{ py: 0 }}>
                        <ListItemText primary={ing} />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Instructions:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {snack.instructions}
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Macros (per serving):
                  </Typography>
                  <Typography variant="body2">
                    {`Calories: ${snack.macros.perServing.calories}, Protein: ${snack.macros.perServing.protein}, Carbs: ${snack.macros.perServing.carbs}, Fat: ${snack.macros.perServing.fat}`}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Paper>
      ))}
    </Container>
  );
};

export default ExampleMealPlansPage;
