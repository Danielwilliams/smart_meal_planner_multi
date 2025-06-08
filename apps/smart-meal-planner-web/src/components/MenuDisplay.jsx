import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RateRecipeButton from './RateRecipeButton';
import MenuRatingModal from './MenuRatingModal';

/** Helper: Map meal_time -> label string */
function getMealLabel(mealTime) {
  switch ((mealTime || '').toLowerCase()) {
    case 'breakfast':
      return 'Breakfast';
    case 'lunch':
      return 'Lunch';
    case 'dinner':
      return 'Dinner';
    default:
      return 'Meal';
  }
}

/** Format macros per serving e.g. "150 cal | 20g protein | 3g carbs | 6g fat" */
function formatPerServingMacros(macros) {
  if (!macros || !macros.perServing) return "No macros available";  // Prevents errors
  const { calories = "N/A", protein = "N/A", carbs = "N/A", fat = "N/A" } = macros.perServing;
  return `${calories} cal | ${protein} protein | ${carbs} carbs | ${fat} fat`;
}

function MenuDisplay({ data }) {
  // 1) Build fallback day array
  let days = [];
  if (data && data.meal_plan && Array.isArray(data.meal_plan.days)) {
    days = data.meal_plan.days;
  }

  // 2) Build default expansions for day, meal, snack
  const defaultDayExp = days.map(() => false);
  const defaultMealExp = days.map(day => (day.meals || []).map(() => false));
  const defaultSnackExp = days.map(day => (day.snacks || []).map(() => false));

  // 3) Define all Hooks unconditionally
  const [printMode, setPrintMode] = useState(false);
  const [dayExpanded, setDayExpanded] = useState(defaultDayExp);
  const [mealExpanded, setMealExpanded] = useState(defaultMealExp);
  const [snackExpanded, setSnackExpanded] = useState(defaultSnackExp);
  const [menuRatingOpen, setMenuRatingOpen] = useState(false);

  // 4) If no days, return "no data" but we've already called our Hooks
  if (!days.length) {
    return <Typography>No meal plan data found.</Typography>;
  }

  // Print flow
  const handlePrint = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 500);
  };

  // Toggling day expansions
  const handleDayToggle = (dayIdx, newVal) => {
    setDayExpanded(prev => {
      const copy = [...prev];
      copy[dayIdx] = newVal;
      return copy;
    });
  };
  // Toggling meal expansions
  const handleMealToggle = (dayIdx, mealIdx, newVal) => {
    setMealExpanded(prev => {
      const copy = [...prev];
      const dayMeals = [...copy[dayIdx]];
      dayMeals[mealIdx] = newVal;
      copy[dayIdx] = dayMeals;
      return copy;
    });
  };
  // Toggling snack expansions
  const handleSnackToggle = (dayIdx, snackIdx, newVal) => {
    setSnackExpanded(prev => {
      const copy = [...prev];
      const daySnacks = [...copy[dayIdx]];
      daySnacks[snackIdx] = newVal;
      copy[dayIdx] = daySnacks;
      return copy;
    });
  };

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2 },
      width: '100%'
    }}>
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: { xs: 2, sm: 1 },
          mb: 2 
        }}
      >
        <Typography 
          variant="h4" 
          sx={{ 
            flexGrow: 1,
            fontSize: { xs: '1.5rem', sm: '2rem' }
          }}
        >
          Meal Plan (Menu ID: {data.menu_id})
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button 
            variant="outlined" 
            onClick={() => setMenuRatingOpen(true)}
            sx={{
              height: { xs: '48px', sm: 'auto' },
              fontSize: { xs: '1rem', sm: 'inherit' }
            }}
          >
            Rate Menu
          </Button>
          <Button 
            variant="contained" 
            onClick={handlePrint}
            sx={{
              height: { xs: '48px', sm: 'auto' },
              fontSize: { xs: '1rem', sm: 'inherit' }
            }}
          >
            Print Full Menu
          </Button>
        </Box>
      </Box>

      {days.map((day, dayIdx) => {
        const meals = day.meals || [];
        const snacks = day.snacks || [];

        const dayIsExpanded = printMode || dayExpanded[dayIdx];

        // Summaries for day-level lines
        const mealLines = meals.map(m => {
          const label = getMealLabel(m.meal_time);
          const macros = formatPerServingMacros(m.macros);
          return macros
            ? `${label}: ${m.title} - (${macros}  /serving )`
            : `${label}: ${m.title}`;
        });

        const snackLines = snacks.map(s => {
          const macros = formatPerServingMacros(s.macros);
          return macros
            ? `Snack: ${s.title} - ( ${macros}  /serving )`
            : `Snack: ${s.title}`;
        });

        return (
          <Accordion
            key={dayIdx}
            sx={{ 
              mb: 2,
              '& .MuiAccordionSummary-root': {
                minHeight: { xs: '60px', sm: 'auto' },
                padding: { xs: '0 16px', sm: 'auto' }
              }
            }}
            expanded={dayIsExpanded}
            onChange={(event, newVal) => handleDayToggle(dayIdx, newVal)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Day {day.dayNumber}
                </Typography>
                <List dense sx={{ pl: 2 }}>
                  {mealLines.map((line, i) => (
                    <ListItem key={`meal-${i}`} disablePadding>
                      <ListItemText primary={line} />
                    </ListItem>
                  ))}
                  {snackLines.map((line, i) => (
                    <ListItem key={`snack-${i}`} disablePadding>
                      <ListItemText primary={line} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </AccordionSummary>

            <AccordionDetails>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Meals
              </Typography>
              {meals.length > 0 ? (
                meals.map((meal, mIdx) => {
                  const isMealExpanded = printMode || mealExpanded[dayIdx][mIdx];
                  return (
                    <Accordion
                      key={mIdx}
                      sx={{ 
                        mb: 2,
                        '& .MuiAccordionSummary-root': {
                          minHeight: { xs: '50px', sm: 'auto' },
                          padding: { xs: '0 16px', sm: 'auto' }
                        },
                        '& .MuiAccordionSummary-content': {
                          margin: { xs: '12px 0', sm: 'auto' }
                        }
                      }}
                      expanded={isMealExpanded}
                      onChange={(event, newVal) => handleMealToggle(dayIdx, mIdx, newVal)}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {getMealLabel(meal.meal_time)}: {meal.title}
                          </Typography>
                          <Box sx={{ ml: 1 }}>
                            <RateRecipeButton
                              recipeId={`${data.menu_id}-${dayIdx}-${mIdx}`}
                              recipeTitle={meal.title}
                              variant="icon"
                              size="small"
                            />
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                          Ingredients:
                        </Typography>
                        <List dense>
                          {meal.ingredients &&
                            meal.ingredients.map((ing, ingIdx) => {
                              if (typeof ing === 'string') {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText primary={ing} />
                                  </ListItem>
                                );
                              } else if (ing.ingredient) {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText
                                      primary={`${ing.ingredient} - ${ing.amount || ''}`}
                                    />
                                  </ListItem>
                                );
                              } else if (ing.item) {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText
                                      primary={`${ing.item} - ${ing.quantity || ''}`}
                                    />
                                  </ListItem>
                                );
                              } else {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText primary={JSON.stringify(ing)} />
                                  </ListItem>
                                );
                              }
                            })}
                        </List>

                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                          Instructions:
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {meal.instructions}
                        </Typography>

                        <Typography variant="body2">
                          <strong>Servings:</strong> {meal.servings}
                        </Typography>
                        {meal.macros && meal.macros.perServing && meal.macros.perMeal && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              Macros (Per Serving):
                            </Typography>
                              {meal.macros?.perServing && (
                                <Typography variant="body2">
                                  <strong>Calories (per serving):</strong> {meal.macros.perServing.calories ?? "N/A"} |
                                  <strong>Protein:</strong> {meal.macros.perServing.protein ?? "N/A"} |
                                  <strong>Carbs:</strong> {meal.macros.perServing.carbs ?? "N/A"} |
                                  <strong>Fat:</strong> {meal.macros.perServing.fat ?? "N/A"}
                                </Typography>
                              )}

                            <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>
                              Macros (Whole Meal):
                            </Typography>
                              {meal.macros?.perServing && (
                                <Typography variant="body2">
                                  <strong>Calories (per serving):</strong> {meal.macros.perServing.calories ?? "N/A"} |
                                  <strong>Protein:</strong> {meal.macros.perServing.protein ?? "N/A"} |
                                  <strong>Carbs:</strong> {meal.macros.perServing.carbs ?? "N/A"} |
                                  <strong>Fat:</strong> {meal.macros.perServing.fat ?? "N/A"}
                                </Typography>
                              )}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  );
                })
              ) : (
                <Typography variant="body2">No meals listed.</Typography>
              )}

              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                Snacks
              </Typography>
              {snacks.length > 0 ? (
                snacks.map((snack, sIdx) => {
                  const isSnackExpanded = printMode || snackExpanded[dayIdx][sIdx];
                  return (
                    <Accordion
                      key={sIdx}
                      sx={{ 
                        mb: 2,
                        '& .MuiAccordionSummary-root': {
                          minHeight: { xs: '50px', sm: 'auto' },
                          padding: { xs: '0 16px', sm: 'auto' }
                        },
                        '& .MuiAccordionSummary-content': {
                          margin: { xs: '12px 0', sm: 'auto' }
                        }
                      }}
                      expanded={isSnackExpanded}
                      onChange={(event, newVal) => handleSnackToggle(dayIdx, sIdx, newVal)}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          Snack: {snack.title}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                          Ingredients:
                        </Typography>
                        <List dense>
                          {snack.ingredients &&
                            snack.ingredients.map((ing, ingIdx) => {
                              if (typeof ing === 'string') {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText primary={ing} />
                                  </ListItem>
                                );
                              } else if (ing.ingredient) {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText
                                      primary={`${ing.ingredient} - ${ing.amount || ''}`}
                                    />
                                  </ListItem>
                                );
                              } else if (ing.item) {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText
                                      primary={`${ing.item} - ${ing.quantity || ''}`}
                                    />
                                  </ListItem>
                                );
                              } else {
                                return (
                                  <ListItem key={ingIdx} disablePadding>
                                    <ListItemText primary={JSON.stringify(ing)} />
                                  </ListItem>
                                );
                              }
                            })}
                        </List>

                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                          Instructions:
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {snack.instructions}
                        </Typography>

                        <Typography variant="body2">
                          <strong>Servings:</strong> {snack.servings}
                        </Typography>
                         {snack.macros?.perServing && snack.macros?.perMeal && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              Macros (Per Serving):
                            </Typography>
                              {meal.macros?.perServing && (
                                <Typography variant="body2">
                                  <strong>Calories (per serving):</strong> {meal.macros.perServing.calories ?? "N/A"} |
                                  <strong>Protein:</strong> {meal.macros.perServing.protein ?? "N/A"} |
                                  <strong>Carbs:</strong> {meal.macros.perServing.carbs ?? "N/A"} |
                                  <strong>Fat:</strong> {meal.macros.perServing.fat ?? "N/A"}
                                </Typography>
                              )}

                            <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>
                              Macros (Whole Snack):
                            </Typography>
                              {meal.macros?.perServing && (
                                <Typography variant="body2">
                                  <strong>Calories (per serving):</strong> {meal.macros.perServing.calories ?? "N/A"} |
                                  <strong>Protein:</strong> {meal.macros.perServing.protein ?? "N/A"} |
                                  <strong>Carbs:</strong> {meal.macros.perServing.carbs ?? "N/A"} |
                                  <strong>Fat:</strong> {meal.macros.perServing.fat ?? "N/A"}
                                </Typography>
                              )}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  );
                })
              ) : (
                <Typography variant="body2">No snacks listed.</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Menu Rating Modal */}
      <MenuRatingModal
        open={menuRatingOpen}
        onClose={() => setMenuRatingOpen(false)}
        menuId={data.menu_id}
        menuTitle={`Meal Plan (${days.length} days)`}
        onRatingSubmitted={(rating) => {
          console.log('Menu rated:', rating);
          setMenuRatingOpen(false);
        }}
      />
    </Box>
  );
}

export default MenuDisplay;
