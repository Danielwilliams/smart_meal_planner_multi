# Recipe Rating System

## Overview
The rating system allows users to rate recipes, menus, and saved recipes. This provides valuable feedback data for AI training and personalized meal planning.

## Database Schema

### Tables Created
1. **Enhanced recipe_interactions**: Extended with rating fields
2. **menu_ratings**: New table for menu ratings
3. **Materialized Views**: For performance optimization

### Key Fields Added
- `rating_score`: 1-5 star rating
- `rating_aspects`: JSON field for detailed aspect ratings
- `feedback_text`: User comments
- `made_recipe`: Boolean if user actually made the recipe
- `would_make_again`: Boolean for remake intention
- `difficulty_rating`: 1-5 complexity rating
- `time_accuracy`: 1-5 rating for time estimation accuracy

## API Endpoints

### Recipe Ratings
- `POST /ratings/recipes/{recipe_id}/rate` - Submit/update recipe rating
- `GET /ratings/recipes/{recipe_id}/ratings` - Get recipe rating summary
- `GET /ratings/recipes/{recipe_id}/my-rating` - Get user's rating for recipe

### Menu Ratings
- `POST /ratings/menus/{menu_id}/rate` - Submit/update menu rating
- `GET /ratings/menus/{menu_id}/ratings` - Get menu rating summary

### Saved Recipe Quick Ratings
- `POST /ratings/saved-recipes/{saved_recipe_id}/quick-rate` - Quick 1-5 star rating

### Analytics
- `GET /ratings/users/me/rating-preferences` - Get user's rating patterns
- `GET /ratings/recipes/recommended` - Get personalized recommendations

## Rating Models

### Recipe Rating
```json
{
  "rating_score": 4.5,
  "rating_aspects": {
    "taste": 5,
    "ease_of_preparation": 4,
    "ingredient_availability": 5,
    "portion_size": 3,
    "nutritional_value": 4,
    "presentation": 4,
    "family_approval": 5
  },
  "feedback_text": "Loved this recipe! Easy to make and kids enjoyed it.",
  "made_recipe": true,
  "would_make_again": true,
  "difficulty_rating": 2,
  "time_accuracy": 4
}
```

### Menu Rating
```json
{
  "rating_score": 4.0,
  "rating_aspects": {
    "variety": 4,
    "practicality": 5,
    "family_approval": 4
  },
  "feedback_text": "Good variety but some recipes were complex.",
  "variety_rating": 4,
  "practicality_rating": 5,
  "family_approval_rating": 4,
  "would_use_again": true
}
```

## Database Views

### recipe_ratings_summary
Aggregates rating data per recipe:
- Total ratings count
- Average rating
- Times made
- Remake percentage
- Average difficulty and time accuracy

### user_rating_preferences
Analyzes user preferences by cuisine:
- Recipes rated per cuisine
- Average rating per cuisine
- High ratings count

### menu_ratings_summary
Aggregates menu rating data:
- Average overall rating
- Average aspect ratings
- Reuse percentage

## Integration Points

### With Saved Recipes
- Links ratings to saved recipes via `rating_id`
- Updates `quick_rating` field
- Tracks `last_made_date`

### With AI System
- Provides preference data for prompt enhancement
- Enables learning from user feedback
- Supports recommendation algorithms

## Usage Examples

### Rating a Recipe (with Authentication)
```python
headers = {"Authorization": "Bearer your_jwt_token"}
rating_data = {
    "rating_score": 4.5,
    "made_recipe": True,
    "would_make_again": True,
    "feedback_text": "Delicious and easy!"
}
response = requests.post(
    "http://localhost:8000/ratings/recipes/123/rate",
    json=rating_data,
    headers=headers
)
```

### Getting Recipe Ratings (Public)
```python
response = requests.get("http://localhost:8000/ratings/recipes/123/ratings")
ratings = response.json()
print(f"Average rating: {ratings['summary']['average_rating']}")
```

## Testing

Run the test script to verify endpoints:
```bash
cd apps/smart-meal-planner-backend
python test_rating_endpoints.py
```

Expected results:
- Authentication-required endpoints return 401 without token
- Public endpoints return valid responses
- No server errors

## Performance Considerations

1. **Indexing**: Indexes added on frequently queried fields
2. **Views**: Materialized views for complex aggregations
3. **Caching**: Consider caching rating summaries
4. **Batch Operations**: Use batch updates for multiple ratings

## Security Features

1. **Authentication**: JWT token required for rating submission
2. **Authorization**: Users can only rate their accessible content
3. **Validation**: Pydantic models validate input data
4. **SQL Injection Prevention**: Parameterized queries used

## Future Enhancements

1. **Photo Uploads**: Allow users to upload photos with ratings
2. **Social Features**: Rating sharing and comparisons
3. **ML Integration**: Use ratings for automatic preference learning
4. **Batch Rating**: Rate multiple recipes from a menu at once
5. **Rating Moderation**: Flag inappropriate content
6. **Rating Trends**: Track rating changes over time

## Migration Notes

- All new fields have default values for backward compatibility
- Existing data is preserved
- No breaking changes to existing APIs
- Optional rating fields allow gradual adoption

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Ensure JWT token is included in request headers
2. **404 Not Found**: Verify recipe/menu ID exists and user has access
3. **422 Validation Error**: Check rating values are within 1-5 range
4. **500 Server Error**: Check database connectivity and schema

### Debug Queries

Check if rating tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('recipe_interactions', 'menu_ratings');
```

Check user's ratings:
```sql
SELECT * FROM recipe_interactions 
WHERE user_id = YOUR_USER_ID AND rating_score IS NOT NULL;
```

Check rating views:
```sql
SELECT * FROM recipe_ratings_summary LIMIT 5;
```