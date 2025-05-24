"""
AI Shopping List Prompt Update

This file contains the updated prompt to generate properly categorized shopping lists.
Replace your existing shopping list generation prompt with this one.
"""

SHOPPING_LIST_PROMPT = """
Create a detailed shopping list for the provided meal plan. Organize the shopping list 
with the following requirements:

1. Format the response as a JSON object with the following structure:
   {
     "groceryList": [
       {"name": "Ingredient Name", "quantity": "Amount with Unit", "category": "Category Name"},
       ...more ingredients
     ],
     "recommendations": ["suggestion 1", "suggestion 2", ...],
     "nutritionTips": ["tip 1", "tip 2", ...],
     "status": "completed"
   }

2. Categories should be one of: "Protein", "Produce", "Dairy", "Grains", "Pantry", "Condiments", "Other"

3. Intelligently determine the appropriate unit of measure for each ingredient based on:
   - Standard culinary conventions (oz for meats, cups for rice, etc.)
   - Consistency within recipe context
   - Appropriate sizing for the total meal plan

4. Combine quantities for repeated ingredients (e.g., if multiple recipes need chicken, sum the total)

5. Standardize units to common grocery shopping measurements:
   - Use "lb" for pounds, "oz" for ounces, "cup" for cups, etc.
   - Include numeric quantities whenever possible (e.g., "2 cups" not just "cups")
   - Use "piece" for countable items like onions, avocados

6. Include 3-5 useful shopping recommendations and nutrition tips

7. Ensure the response is properly formatted JSON that can be parsed by JavaScript

Here's the meal plan to analyze:
"""

# Example of how this would be used in your API endpoint:
"""
def generate_ai_shopping_list(menu_id: int, user_preferences: dict = None):
    # Fetch meal plan data
    meal_plan = get_meal_plan_by_id(menu_id)
    
    # Create the prompt with the updated template
    prompt = SHOPPING_LIST_PROMPT + json.dumps(meal_plan)
    
    # Send to OpenAI or your preferred AI service
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful meal planning assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,  # Lower temperature for more consistent formatting
    )
    
    # Parse and return the response
    try:
        return json.loads(response.choices[0].message.content)
    except:
        # Fallback in case of parsing errors
        return {"status": "error", "message": "Failed to parse AI response"}
"""