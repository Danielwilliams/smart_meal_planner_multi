# Rating System Integration Guide

## Overview
The rating system has been successfully integrated into the Smart Meal Planner application. This guide shows what was added and how to use the rating components in other parts of the app.

## What Was Integrated

### 1. MenuDisplay Component (`src/components/MenuDisplay.jsx`)
- ✅ **Menu Rating Button**: Added "Rate Menu" button next to "Print Full Menu" 
- ✅ **Recipe Rating Icons**: Each meal now has a star icon to rate individual recipes
- ✅ **Menu Rating Modal**: Full modal for rating entire menu plans

### 2. SavedRecipesPage (`src/pages/SavedRecipesPage.jsx`)
- ✅ **Quick Rating**: Added star rating component to each saved recipe card
- ✅ **Persistent Ratings**: Ratings are saved to the database and persist across sessions

### 3. API Integration (`src/services/apiService.js`)
- ✅ **Rating Endpoints**: All rating API methods added
- ✅ **Authentication**: Proper JWT token handling for rating submissions

## Components Available

### Core Components

#### 1. `StarRating` - Base star rating component
```jsx
import StarRating from '../components/StarRating';

<StarRating
  value={4.5}
  onChange={(newValue) => console.log(newValue)}
  size="large" // small, medium, large
  showValue={true}
  showCount={true}
  count={127}
  readOnly={false}
/>
```

#### 2. `RateRecipeButton` - Recipe rating button
```jsx
import RateRecipeButton from '../components/RateRecipeButton';

<RateRecipeButton
  recipeId={recipe.id}
  recipeTitle={recipe.title}
  hasRating={false}
  currentRating={0}
  variant="icon" // or "button"
  onRatingUpdate={(data) => console.log('Rating updated:', data)}
/>
```

#### 3. `QuickRating` - Simple rating for saved recipes
```jsx
import QuickRating from '../components/QuickRating';

<QuickRating
  savedRecipeId={recipe.id}
  currentRating={recipe.rating || 0}
  onRatingUpdate={(newRating) => updateRecipeRating(recipe.id, newRating)}
/>
```

#### 4. `MenuRatingModal` - Full menu rating modal
```jsx
import MenuRatingModal from '../components/MenuRatingModal';

<MenuRatingModal
  open={modalOpen}
  onClose={() => setModalOpen(false)}
  menuId={menu.id}
  menuTitle={menu.title}
  onRatingSubmitted={(rating) => console.log('Menu rated:', rating)}
/>
```

#### 5. `RecipeRatingDisplay` - Show aggregated ratings
```jsx
import RecipeRatingDisplay from '../components/RecipeRatingDisplay';

<RecipeRatingDisplay 
  recipeId={recipe.id}
  compact={false} // or true for inline display
/>
```

## How to Add Ratings to Other Components

### Recipe Cards/Lists
Add this to any recipe display:
```jsx
import RateRecipeButton from '../components/RateRecipeButton';
import RecipeRatingDisplay from '../components/RecipeRatingDisplay';

// In your JSX:
<Box display="flex" alignItems="center" justifyContent="space-between">
  <Typography variant="h6">{recipe.title}</Typography>
  <RateRecipeButton
    recipeId={recipe.id}
    recipeTitle={recipe.title}
    variant="icon"
  />
</Box>

<RecipeRatingDisplay recipeId={recipe.id} compact={true} />
```

### Recipe Detail Pages
Add comprehensive rating display:
```jsx
import RecipeRatingDisplay from '../components/RecipeRatingDisplay';
import RateRecipeButton from '../components/RateRecipeButton';

// In your recipe details:
<Box sx={{ my: 3 }}>
  <Box display="flex" alignItems="center" gap={2} mb={2}>
    <Typography variant="h4">{recipe.title}</Typography>
    <RateRecipeButton
      recipeId={recipe.id}
      recipeTitle={recipe.title}
      variant="button"
      showText={true}
    />
  </Box>
  
  <RecipeRatingDisplay recipeId={recipe.id} />
</Box>
```

### Menu Lists/History
Add menu rating functionality:
```jsx
import MenuRatingModal from '../components/MenuRatingModal';

const [ratingModalOpen, setRatingModalOpen] = useState(false);
const [selectedMenu, setSelectedMenu] = useState(null);

// In your JSX:
<Button onClick={() => {
  setSelectedMenu(menu);
  setRatingModalOpen(true);
}}>
  Rate This Menu
</Button>

<MenuRatingModal
  open={ratingModalOpen}
  onClose={() => setRatingModalOpen(false)}
  menuId={selectedMenu?.id}
  menuTitle={selectedMenu?.title}
  onRatingSubmitted={() => setRatingModalOpen(false)}
/>
```

## API Usage Examples

### Get Recipe Ratings
```javascript
import apiService from '../services/apiService';

const ratings = await apiService.getRecipeRatings(recipeId);
console.log('Average rating:', ratings.summary.average_rating);
console.log('Total ratings:', ratings.summary.total_ratings);
```

### Submit Recipe Rating
```javascript
const ratingData = {
  rating_score: 4.5,
  feedback_text: "Delicious recipe!",
  made_recipe: true,
  would_make_again: true,
  difficulty_rating: 3,
  time_accuracy: 4
};

await apiService.rateRecipe(recipeId, ratingData);
```

### Get User's Rating Preferences
```javascript
const preferences = await apiService.getRatingPreferences();
console.log('Preferred cuisines:', preferences.cuisine_preferences);
console.log('Top rated recipes:', preferences.top_rated_recipes);
```

## Database Integration

### Tables Used
- `recipe_interactions`: Stores detailed recipe ratings
- `menu_ratings`: Stores menu ratings
- `saved_recipes`: Links to ratings and stores quick ratings

### Key Fields
- `rating_score`: 1-5 star rating
- `rating_aspects`: JSON with detailed aspect ratings
- `feedback_text`: User comments
- `made_recipe`: Boolean if user made the recipe
- `would_make_again`: Boolean for remake intention

## Testing the Integration

### 1. Test Recipe Rating
1. Navigate to Menu page
2. Expand a day and meal
3. Click the star icon next to a recipe title
4. Submit a rating with feedback
5. Verify the rating appears in the database

### 2. Test Menu Rating
1. Navigate to Menu page
2. Click "Rate Menu" button
3. Fill out the menu rating form
4. Submit the rating
5. Check that it's stored in `menu_ratings` table

### 3. Test Quick Rating on Saved Recipes
1. Navigate to Saved Recipes page
2. Find a saved recipe card
3. Click on the stars to rate it
4. Verify the rating persists on page refresh

## Future Enhancement Opportunities

### 1. Recipe Browser Integration
Add ratings to any recipe browsing/search interfaces:
```jsx
<RecipeCard>
  <RecipeRatingDisplay recipeId={recipe.id} compact={true} />
  <RateRecipeButton recipeId={recipe.id} recipeTitle={recipe.title} />
</RecipeCard>
```

### 2. Organization Recipe Library
For organization-specific recipes, add rating functionality for clients to rate organization recipes.

### 3. Recommendation System
Use the existing `apiService.getRecommendedRecipes()` to show personalized recipe recommendations based on ratings.

### 4. Analytics Dashboard
Create admin views showing:
- Most highly rated recipes
- Recipe rating trends
- User engagement with ratings

## Styling and Customization

### Theme Integration
All components use Material-UI theming and will automatically adapt to your app's theme.

### Custom Colors
```jsx
<StarRating
  color="secondary" // primary, secondary, error, warning, info, success
  value={rating}
/>
```

### Size Variants
```jsx
<RateRecipeButton
  size="small" // small, medium, large
  variant="icon" // icon, button
/>
```

## Performance Considerations

### 1. Caching
- Rating summaries are cached on the backend
- Use React.memo for rating components in lists
- Consider implementing optimistic updates

### 2. Loading States
All components handle loading states automatically and show appropriate UI feedback.

### 3. Error Handling
Components include built-in error handling with user-friendly messages.

## Security Notes

- All rating endpoints require authentication
- Users can only rate recipes they have access to
- SQL injection protection is built into the backend
- Input validation prevents malicious rating data

This integration provides a solid foundation for collecting user feedback and improving the meal planning AI system!