// src/components/PreferencesForm.jsx
import React from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  InputAdornment,
  Alert,
  Divider,
  Slider,
  FormGroup,
  FormHelperText,
  Radio,
  RadioGroup
} from '@mui/material';
import MacroDefaults from './MacroDefaults';

const PreferencesForm = ({
  preferences,
  setPreferences,
  flavorPreferences,
  setFlavorPreferences,
  spiceLevel,
  setSpiceLevel,
  recipeTypePreferences,
  setRecipeTypePreferences,
  mealTimePreferences,
  setMealTimePreferences,
  timeConstraints,
  setTimeConstraints,
  prepPreferences,
  setPrepPreferences,
  preferredProteins,
  setPreferredProteins,
  otherProteins = { meat: '', seafood: '', vegetarian_vegan: '', other: '' },
  setOtherProteins,
  loading,
  message,
  error,
  onSubmit,
  submitButtonText = "Save Preferences",
  title = "Set Your Meal Preferences"
}) => {

  const getPrepComplexityLabel = (value) => {
    if (value <= 25) return 'Minimal Prep (Quick & Easy)';
    if (value <= 50) return 'Moderate Prep';
    if (value <= 75) return 'Standard Cooking';
    return 'Complex Recipes';
  };

  return (
    <form onSubmit={onSubmit}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      {/* Diet Types */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Diet Types
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(preferences.dietTypes).map((type) => (
            <Grid item xs={6} sm={4} key={type}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={preferences.dietTypes[type]}
                    onChange={(e) => {
                      setPreferences(prev => ({
                        ...prev,
                        dietTypes: {
                          ...prev.dietTypes,
                          [type]: e.target.checked
                        }
                      }));
                    }}
                  />
                }
                label={type}
              />
            </Grid>
          ))}
        </Grid>
        {preferences.dietTypes.Other && (
          <TextField
            fullWidth
            margin="normal"
            label="Other Diet Type"
            value={preferences.otherDietType}
            onChange={(e) => {
              setPreferences(prev => ({
                ...prev,
                otherDietType: e.target.value
              }));
            }}
            placeholder="Please specify your diet type"
          />
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Recipe Types */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Recipe Types (Cuisines)
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(preferences.recipeTypes).map((type) => (
            <Grid item xs={6} sm={4} key={type}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={preferences.recipeTypes[type]}
                    onChange={(e) => {
                      setPreferences(prev => ({
                        ...prev,
                        recipeTypes: {
                          ...prev.recipeTypes,
                          [type]: e.target.checked
                        }
                      }));
                    }}
                  />
                }
                label={type}
              />
            </Grid>
          ))}
        </Grid>
        {preferences.recipeTypes.Other && (
          <TextField
            fullWidth
            margin="normal"
            label="Other Recipe Type"
            value={preferences.otherRecipeType}
            onChange={(e) => {
              setPreferences(prev => ({
                ...prev,
                otherRecipeType: e.target.value
              }));
            }}
            placeholder="Please specify your preferred cuisine"
          />
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Preferred Proteins */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Preferred Proteins
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the protein sources you prefer to see in your meals
        </Typography>
        
        {/* Meat Proteins */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
            Meat
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(preferredProteins?.meat || {})
              .sort(([a], [b]) => a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b))
              .map(([protein, selected]) => (
              <Grid item xs={6} sm={4} key={protein}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected}
                      onChange={(e) => {
                        setPreferredProteins(prev => ({
                          ...prev,
                          meat: {
                            ...prev.meat,
                            [protein]: e.target.checked
                          }
                        }));
                      }}
                    />
                  }
                  label={protein === 'other' ? 'Other' : protein.charAt(0).toUpperCase() + protein.slice(1)}
                />
              </Grid>
            ))}
          </Grid>
          {preferredProteins?.meat?.other && otherProteins && (
            <TextField
              fullWidth
              margin="normal"
              label="Other Meat Proteins"
              value={otherProteins?.meat || ''}
              onChange={(e) => {
                if (setOtherProteins) {
                  setOtherProteins(prev => ({
                    ...prev,
                    meat: e.target.value
                  }));
                }
              }}
              placeholder="e.g., venison, duck, rabbit"
              helperText="Specify other meat proteins, separated by commas"
            />
          )}
        </Box>

        {/* Seafood Proteins */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
            Seafood
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(preferredProteins?.seafood || {})
              .sort(([a], [b]) => a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b))
              .map(([protein, selected]) => (
              <Grid item xs={6} sm={4} key={protein}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected}
                      onChange={(e) => {
                        setPreferredProteins(prev => ({
                          ...prev,
                          seafood: {
                            ...prev.seafood,
                            [protein]: e.target.checked
                          }
                        }));
                      }}
                    />
                  }
                  label={protein === 'other' ? 'Other' : protein.charAt(0).toUpperCase() + protein.slice(1)}
                />
              </Grid>
            ))}
          </Grid>
          {preferredProteins?.seafood?.other && otherProteins && (
            <TextField
              fullWidth
              margin="normal"
              label="Other Seafood Proteins"
              value={otherProteins?.seafood || ''}
              onChange={(e) => {
                if (setOtherProteins) {
                  setOtherProteins(prev => ({
                    ...prev,
                    seafood: e.target.value
                  }));
                }
              }}
              placeholder="e.g., lobster, scallops, mackerel"
              helperText="Specify other seafood proteins, separated by commas"
            />
          )}
        </Box>

        {/* Vegetarian/Vegan Proteins */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
            Vegetarian/Vegan
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(preferredProteins?.vegetarian_vegan || {})
              .sort(([a], [b]) => a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b))
              .map(([protein, selected]) => (
              <Grid item xs={6} sm={4} key={protein}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected}
                      onChange={(e) => {
                        setPreferredProteins(prev => ({
                          ...prev,
                          vegetarian_vegan: {
                            ...prev.vegetarian_vegan,
                            [protein]: e.target.checked
                          }
                        }));
                      }}
                    />
                  }
                  label={protein === 'other' ? 'Other' : protein.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
              </Grid>
            ))}
          </Grid>
          {preferredProteins?.vegetarian_vegan?.other && otherProteins && (
            <TextField
              fullWidth
              margin="normal"
              label="Other Vegetarian/Vegan Proteins"
              value={otherProteins?.vegetarian_vegan || ''}
              onChange={(e) => {
                if (setOtherProteins) {
                  setOtherProteins(prev => ({
                    ...prev,
                    vegetarian_vegan: e.target.value
                  }));
                }
              }}
              placeholder="e.g., hemp seeds, spirulina, nutritional yeast"
              helperText="Specify other vegetarian/vegan proteins, separated by commas"
            />
          )}
        </Box>

        {/* Other Proteins */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
            Other
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(preferredProteins?.other || {})
              .sort(([a], [b]) => a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b))
              .map(([protein, selected]) => (
              <Grid item xs={6} sm={4} key={protein}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected}
                      onChange={(e) => {
                        setPreferredProteins(prev => ({
                          ...prev,
                          other: {
                            ...prev.other,
                            [protein]: e.target.checked
                          }
                        }));
                      }}
                    />
                  }
                  label={protein === 'other' ? 'Other' : protein.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
              </Grid>
            ))}
          </Grid>
          {preferredProteins?.other?.other && otherProteins && (
            <TextField
              fullWidth
              margin="normal"
              label="Other Protein Sources"
              value={otherProteins?.other || ''}
              onChange={(e) => {
                if (setOtherProteins) {
                  setOtherProteins(prev => ({
                    ...prev,
                    other: e.target.value
                  }));
                }
              }}
              placeholder="e.g., cricket flour, algae, bone broth"
              helperText="Specify other protein sources, separated by commas"
            />
          )}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Dietary Restrictions */}
      <TextField
        fullWidth
        multiline
        rows={3}
        margin="normal"
        label="Dietary Restrictions"
        value={preferences.dietaryRestrictions}
        onChange={(e) => {
          setPreferences(prev => ({
            ...prev,
            dietaryRestrictions: e.target.value
          }));
        }}
        placeholder="e.g., No nuts, shellfish allergy, Low Sodium, etc."
        helperText="Please list any allergies or dietary restrictions (include Low Sodium if needed)"
      />

      {/* Disliked Ingredients */}
      <TextField
        fullWidth
        multiline
        rows={3}
        margin="normal"
        label="Disliked Ingredients"
        value={preferences.dislikedIngredients}
        onChange={(e) => {
          setPreferences(prev => ({
            ...prev,
            dislikedIngredients: e.target.value
          }));
        }}
        placeholder="e.g., mushrooms, liver, blue cheese, etc."
        helperText="List ingredients you prefer to avoid"
      />

      <Divider sx={{ my: 3 }} />

      {/* Meal Times */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Meal Times
        </Typography>
        <FormGroup row>
          {Object.keys(preferences.mealTimes).map((mealTime) => (
            <FormControlLabel
              key={mealTime}
              control={
                <Checkbox
                  checked={preferences.mealTimes[mealTime]}
                  onChange={(e) => {
                    setPreferences(prev => ({
                      ...prev,
                      mealTimes: {
                        ...prev.mealTimes,
                        [mealTime]: e.target.checked
                      }
                    }));
                  }}
                />
              }
              label={mealTime.charAt(0).toUpperCase() + mealTime.slice(1)}
            />
          ))}
        </FormGroup>
      </Box>

      {/* Appliances */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Available Appliances
        </Typography>
        <FormGroup row>
          {Object.keys(preferences.appliances).map((appliance) => (
            <FormControlLabel
              key={appliance}
              control={
                <Checkbox
                  checked={preferences.appliances[appliance]}
                  onChange={(e) => {
                    setPreferences(prev => ({
                      ...prev,
                      appliances: {
                        ...prev.appliances,
                        [appliance]: e.target.checked
                      }
                    }));
                  }}
                />
              }
              label={appliance === 'airFryer' ? 'Air Fryer' : 
                     appliance === 'instapot' ? 'Instant Pot' : 'Crock Pot'}
            />
          ))}
        </FormGroup>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Servings and Complexity */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Servings Per Meal"
            value={preferences.servingsPerMeal}
            onChange={(e) => {
              setPreferences(prev => ({
                ...prev,
                servingsPerMeal: parseInt(e.target.value) || 1
              }));
            }}
            InputProps={{
              inputProps: { min: 1, max: 10 }
            }}
            helperText="Number of people to cook for"
          />
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Snacks Per Day"
            value={preferences.snacksPerDay}
            onChange={(e) => {
              setPreferences(prev => ({
                ...prev,
                snacksPerDay: parseInt(e.target.value) || 0
              }));
            }}
            InputProps={{
              inputProps: { min: 0, max: 3 }
            }}
            helperText="Healthy snacks to include"
          />
        </Grid>
      </Grid>

      {/* Prep Complexity Slider - matching individual preferences */}
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Meal Preparation Complexity
        </Typography>
        <Box sx={{ px: 2 }}>
          <Slider
            value={preferences.prepComplexity}
            onChange={(e, newValue) => {
              setPreferences(prev => ({
                ...prev,
                prepComplexity: newValue
              }));
            }}
            valueLabelDisplay="auto"
            valueLabelFormat={getPrepComplexityLabel}
            step={25}
            marks={[
              { value: 0, label: 'Minimal' },
              { value: 25, label: 'Easy' },
              { value: 50, label: 'Moderate' },
              { value: 75, label: 'Standard' },
              { value: 100, label: 'Complex' }
            ]}
            min={0}
            max={100}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          {getPrepComplexityLabel(preferences.prepComplexity)}
        </Typography>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Macro Goals */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Nutritional Goals
        </Typography>
        <MacroDefaults
          onMacroChange={(macros) => {
            setPreferences(prev => ({
              ...prev,
              macroGoals: {
                protein: macros.protein,
                carbs: macros.carbs,
                fat: macros.fat,
                calories: macros.calories
              }
            }));
          }}
          initialValues={preferences.macroGoals}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Flavor Preferences */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Flavor Preferences
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(flavorPreferences).map((flavor) => (
            <Grid item xs={6} sm={4} key={flavor}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={flavorPreferences[flavor]}
                    onChange={(e) => {
                      setFlavorPreferences(prev => ({
                        ...prev,
                        [flavor]: e.target.checked
                      }));
                    }}
                  />
                }
                label={flavor.charAt(0).toUpperCase() + flavor.slice(1)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Spice Level */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Spice Level
        </Typography>
        <RadioGroup
          row
          value={spiceLevel}
          onChange={(e) => setSpiceLevel(e.target.value)}
        >
          <FormControlLabel value="mild" control={<Radio />} label="Mild" />
          <FormControlLabel value="medium" control={<Radio />} label="Medium" />
          <FormControlLabel value="hot" control={<Radio />} label="Hot" />
          <FormControlLabel value="extra-hot" control={<Radio />} label="Extra Hot" />
        </RadioGroup>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Recipe Type Preferences */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Recipe Style Preferences
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(recipeTypePreferences).map((style) => (
            <Grid item xs={6} sm={4} key={style}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={recipeTypePreferences[style]}
                    onChange={(e) => {
                      setRecipeTypePreferences(prev => ({
                        ...prev,
                        [style]: e.target.checked
                      }));
                    }}
                  />
                }
                label={style.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Meal Time Preferences */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Meal Time Preferences
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(mealTimePreferences).map((mealTime) => (
            <Grid item xs={6} sm={4} key={mealTime}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={mealTimePreferences[mealTime]}
                    onChange={(e) => {
                      setMealTimePreferences(prev => ({
                        ...prev,
                        [mealTime]: e.target.checked
                      }));
                    }}
                  />
                }
                label={mealTime.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Time Constraints - using sliders like individual preferences */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Time Constraints
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Maximum prep time (minutes) for each meal
        </Typography>
        {Object.entries(timeConstraints).map(([mealType, minutes]) => (
          <Box key={mealType} sx={{ mb: 2 }}>
            <Typography variant="body2">
              {mealType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </Typography>
            <Slider
              value={minutes}
              min={5}
              max={60}
              step={5}
              marks
              valueLabelDisplay="auto"
              onChange={(e, value) => {
                setTimeConstraints(prev => ({
                  ...prev,
                  [mealType]: value
                }));
              }}
            />
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Prep Preferences */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Preparation Preferences
        </Typography>
        <Grid container spacing={2}>
          {Object.keys(prepPreferences).map((prep) => (
            <Grid item xs={6} sm={4} key={prep}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={prepPreferences[prep]}
                    onChange={(e) => {
                      setPrepPreferences(prev => ({
                        ...prev,
                        [prep]: e.target.checked
                      }));
                    }}
                  />
                }
                label={prep.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Kroger Integration */}
      <Box sx={{ mt: 3, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Kroger Integration (Optional)
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Kroger Username"
              value={preferences.krogerUsername}
              onChange={(e) => {
                setPreferences(prev => ({
                  ...prev,
                  krogerUsername: e.target.value
                }));
              }}
              placeholder="Your Kroger account username"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="password"
              label="Kroger Password"
              value={preferences.krogerPassword}
              onChange={(e) => {
                setPreferences(prev => ({
                  ...prev,
                  krogerPassword: e.target.value
                }));
              }}
              placeholder="Your Kroger account password"
            />
          </Grid>
        </Grid>
        <FormHelperText>
          Optional: Connect your Kroger account for seamless grocery shopping
        </FormHelperText>
      </Box>

      {/* Submit Button */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ minWidth: 200 }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Saving...
            </>
          ) : (
            submitButtonText
          )}
        </Button>
      </Box>
    </form>
  );
};

export default PreferencesForm;