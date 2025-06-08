# AI Recipe Integration Plan with Rating System

## Executive Summary
This document outlines a comprehensive plan to:
1. Implement a recipe rating system as the foundation for AI training
2. Integrate user saved recipes and ratings into the ChatGPT meal generation prompt
3. Implement custom AI model training functionality using user feedback data

## Current State Analysis

### 1. AI Meal Generation System
- **Model**: Uses OpenAI GPT-3.5/GPT-4 via API
- **Prompt Location**: `/apps/smart-meal-planner-backend/app/routers/menu.py`
- **Generation Methods**: 
  - Optimized single-request (currently disabled due to token limits)
  - Legacy multi-request (currently active)
- **Current Limitations**:
  - No user feedback loop
  - No learning from user preferences
  - No quality metrics for generated meals

### 2. Existing Recipe Tracking
- **Database Tables**:
  - `saved_recipes`: User's saved recipes with menu context
  - `scraped_recipes`: Master recipe database (900+ recipes)
  - `recipe_interactions`: Basic interaction tracking (exists but underutilized)
- **Current Gaps**:
  - No rating system
  - No feedback collection
  - No preference learning
  - Limited interaction tracking

## Phase 0: Recipe Rating System Implementation

### 0.1 Database Schema Enhancement
```sql
-- Enhance recipe_interactions table
ALTER TABLE recipe_interactions 
ADD COLUMN rating_score DECIMAL(2,1) CHECK (rating_score >= 1 AND rating_score <= 5),
ADD COLUMN rating_aspects JSONB DEFAULT '{}',
ADD COLUMN feedback_text TEXT,
ADD COLUMN made_recipe BOOLEAN DEFAULT FALSE,
ADD COLUMN would_make_again BOOLEAN,
ADD COLUMN difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
ADD COLUMN time_accuracy INTEGER CHECK (time_accuracy >= 1 AND time_accuracy <= 5);

-- Create recipe_ratings view for aggregation
CREATE VIEW recipe_ratings_summary AS
SELECT 
    recipe_id,
    COUNT(DISTINCT user_id) as total_ratings,
    AVG(rating_score) as average_rating,
    COUNT(CASE WHEN made_recipe = TRUE THEN 1 END) as times_made,
    AVG(CASE WHEN would_make_again = TRUE THEN 100 ELSE 0 END) as remake_percentage,
    AVG(difficulty_rating) as avg_difficulty,
    AVG(time_accuracy) as avg_time_accuracy
FROM recipe_interactions
WHERE rating_score IS NOT NULL
GROUP BY recipe_id;

-- Create user_rating_preferences view
CREATE VIEW user_rating_preferences AS
SELECT 
    ri.user_id,
    sr.cuisine,
    sr.complexity,
    sr.component_type,
    AVG(ri.rating_score) as avg_rating,
    COUNT(*) as rating_count
FROM recipe_interactions ri
JOIN scraped_recipes sr ON ri.recipe_id = sr.id
WHERE ri.rating_score IS NOT NULL
GROUP BY ri.user_id, sr.cuisine, sr.complexity, sr.component_type;
```

### 0.2 Rating Aspects Structure
```json
{
  "taste": 5,
  "ease_of_preparation": 4,
  "ingredient_availability": 5,
  "portion_size": 3,
  "nutritional_value": 4,
  "presentation": 4,
  "family_approval": 5
}
```

### 0.3 API Endpoints for Rating System
```python
# New endpoints in app/routers/recipe_ratings.py
@router.post("/recipes/{recipe_id}/rate")
async def rate_recipe(
    recipe_id: int,
    rating: RecipeRating,
    user = Depends(get_user_from_token)
):
    """Submit or update a recipe rating"""

@router.get("/recipes/{recipe_id}/ratings")
async def get_recipe_ratings(recipe_id: int):
    """Get aggregated ratings for a recipe"""

@router.get("/users/{user_id}/ratings")
async def get_user_ratings(
    user_id: int,
    user = Depends(get_user_from_token)
):
    """Get all ratings by a user"""

@router.get("/recipes/recommended")
async def get_recommended_recipes(
    user = Depends(get_user_from_token)
):
    """Get recipe recommendations based on ratings"""
```

### 0.4 Frontend Rating Components
```jsx
// RecipeRatingModal.jsx
- Star rating component (1-5 stars)
- Aspect-based rating (taste, ease, etc.)
- "Made this recipe" checkbox
- "Would make again" toggle
- Difficulty slider
- Time accuracy rating
- Optional feedback text

// RecipeRatingDisplay.jsx
- Average rating display
- Rating distribution chart
- Aspect breakdown
- User testimonials
- "Based on X ratings" label
```

## Phase 1: Enhanced AI Integration with Ratings

### 1.1 Rating-Informed Preference Analysis
```python
def get_user_recipe_preferences_with_ratings(user_id, for_client_id=None):
    """
    Analyze user's saved recipes AND ratings to extract preferences
    Returns:
    - Highly rated recipes (4+ stars)
    - Preferred cuisines by rating
    - Ingredient preferences from high-rated recipes
    - Disliked patterns from low-rated recipes
    - Optimal complexity level
    - Time constraint accuracy
    """
```

### 1.2 Enhanced Prompt with Rating Data
```python
system_prompt = f"""
You are an advanced meal planning assistant that creates personalized meal plans.

USER'S RECIPE PREFERENCES (Based on Ratings):
- Highly Rated Recipes (4.5+ stars): {top_rated_recipes}
- Favorite Cuisines (avg 4+ stars): {preferred_cuisines}
- Preferred Complexity (based on ratings): {optimal_complexity}
- Ingredients from 5-star recipes: {loved_ingredients}
- Avoid (from low ratings): {poor_rated_patterns}
- Time Accuracy Preference: {time_accuracy_preference}
- Family Approval Required: {family_friendly_requirement}

RATING-BASED GENERATION RULES:
1. Prioritize recipes similar to 4.5+ star rated meals
2. Avoid patterns from recipes rated below 3 stars
3. Match complexity to user's success rate
4. Consider time accuracy feedback
5. Include variety while respecting proven preferences

{existing_requirements}
"""
```

### 1.3 Feedback Loop Implementation
```python
# After menu generation
def track_menu_performance(menu_id, user_id):
    """
    Track which generated recipes get made and rated
    - Monitor acceptance rate
    - Track rating scores
    - Identify successful patterns
    - Flag problematic suggestions
    """
```

## Phase 2: Machine Learning Pipeline

### 2.1 Training Data Structure
```python
# Enhanced training data with ratings
training_example = {
    "user_preferences": {
        "dietary_restrictions": ["vegetarian"],
        "highly_rated_recipes": [
            {"id": 123, "title": "Veggie Stir Fry", "rating": 4.8},
            {"id": 456, "title": "Mushroom Risotto", "rating": 4.5}
        ],
        "cuisine_ratings": {
            "Italian": 4.6,
            "Asian": 4.3,
            "Mexican": 3.2
        },
        "complexity_success_rate": {
            "easy": 0.95,
            "moderate": 0.80,
            "complex": 0.40
        }
    },
    "generated_meal": {
        "title": "Vegetarian Pad Thai",
        "predicted_rating": 4.4
    },
    "actual_outcome": {
        "was_made": True,
        "rating": 4.6,
        "feedback": "Loved it! Similar to my favorite stir fry"
    }
}
```

### 2.2 Continuous Learning System
```python
class RatingBasedLearningSystem:
    def update_user_model(self, user_id, new_rating):
        """Update user preference model with new rating"""
        
    def retrain_generation_model(self):
        """Periodic retraining with accumulated ratings"""
        
    def calculate_recipe_success_probability(self, user_id, recipe_id):
        """Predict rating for a recipe-user pair"""
        
    def optimize_meal_plan_quality(self, meal_plan, user_id):
        """Optimize plan based on predicted ratings"""
```

## Implementation Timeline

### Week 1: Rating System Foundation
**Day 1-2**: Database and Backend
- Implement database schema changes
- Create rating API endpoints
- Add rating aggregation views
- Implement rating validation logic

**Day 3-4**: Frontend Rating Components
- Build rating modal component
- Create rating display widgets
- Add rating to recipe cards
- Implement rating history view

**Day 5**: Integration Testing
- Test rating submission flow
- Validate data aggregation
- Test edge cases
- Performance optimization

### Week 2: Rating Analytics & Insights
**Day 1-2**: Analytics Dashboard
- Create rating analytics views
- Build preference extraction logic
- Implement trend analysis
- Add rating-based recommendations

**Day 3-4**: User Preference Profiles
- Generate preference summaries
- Create cuisine affinity scores
- Build complexity success metrics
- Implement ingredient preference tracking

**Day 5**: Testing and Refinement
- Validate preference calculations
- Test recommendation accuracy
- Optimize query performance
- User acceptance testing

### Week 3: AI Integration with Ratings
**Day 1-2**: Prompt Enhancement
- Modify prompt construction
- Add rating data to context
- Implement preference weighting
- Add negative preference handling

**Day 3-4**: Feedback Loop
- Create post-generation tracking
- Implement rating prediction
- Add success monitoring
- Build learning pipeline

**Day 5**: Integration Testing
- Test enhanced generation
- Validate rating influence
- Measure improvement metrics
- A/B testing setup

### Week 4: Machine Learning Implementation
**Day 1-2**: Training Pipeline
- Build training data exporter
- Implement model training logic
- Create validation framework
- Add performance metrics

**Day 3-4**: Model Deployment
- Implement model versioning
- Create deployment pipeline
- Add monitoring system
- Build fallback mechanisms

**Day 5**: End-to-End Testing
- Full system validation
- Performance benchmarking
- User acceptance testing
- Documentation completion

## Success Metrics

### Rating System KPIs
- **User Engagement**: 60%+ of users rate recipes
- **Rating Volume**: Average 5+ ratings per active user/month
- **Rating Quality**: 80%+ include aspect ratings
- **Feedback Rate**: 30%+ include text feedback

### AI Improvement KPIs
- **Predicted vs Actual Rating**: <0.5 star difference
- **High-Rated Recipe Generation**: 70%+ recipes rated 4+ stars
- **Low Rating Reduction**: <10% recipes rated below 3 stars
- **User Satisfaction**: 25% increase in menu acceptance

### Learning System KPIs
- **Preference Accuracy**: 85%+ match rate
- **Recommendation Success**: 60%+ recommended recipes tried
- **Model Performance**: 30% improvement after 3 months
- **Cost Efficiency**: 40% reduction in regeneration requests

## Technical Architecture

### 1. Data Flow
```
User Rates Recipe → Database → Analytics Pipeline → 
Preference Extraction → AI Prompt Enhancement → 
Better Recommendations → User Rates → Continuous Loop
```

### 2. Caching Strategy
- Cache user preferences (1 hour)
- Cache rating aggregations (10 minutes)
- Cache recommendation scores (30 minutes)
- Invalidate on new ratings

### 3. Performance Considerations
- Async rating processing
- Batch preference updates
- Materialized views for aggregations
- Background job for ML training

## Risk Mitigation

### 1. Data Quality
- Minimum ratings threshold for preferences
- Outlier detection for ratings
- Spam/abuse prevention
- Rating authenticity verification

### 2. Cold Start Problem
- Default preferences for new users
- Onboarding rating flow
- Popular recipe recommendations
- Progressive personalization

### 3. Bias Prevention
- Diversity requirements in generation
- Exploration vs exploitation balance
- Regular preference reset option
- Multi-aspect optimization

## Future Enhancements

### 1. Advanced Rating Features
- Photo uploads with ratings
- Recipe modifications tracking
- Social rating sharing
- Professional chef ratings

### 2. Predictive Analytics
- Meal plan success prediction
- Seasonal preference adjustment
- Special occasion planning
- Budget-based optimization

### 3. Community Features
- Recipe rating leaderboards
- Trusted reviewer system
- Recipe challenges
- Collaborative meal planning

## Conclusion

By implementing a comprehensive rating system before AI integration, we create a robust feedback loop that enables:
1. Data-driven preference learning
2. Continuous model improvement
3. Measurable user satisfaction
4. Personalized meal planning that improves over time

The rating system serves as the foundation for building an AI that truly understands and adapts to each user's unique preferences, creating a more engaging and successful meal planning experience.