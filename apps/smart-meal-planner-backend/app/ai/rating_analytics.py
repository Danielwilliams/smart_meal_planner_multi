# app/ai/rating_analytics.py - Rating Analytics and Preference Extraction

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import statistics
import json
from collections import defaultdict, Counter
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

class RatingAnalytics:
    """
    Advanced analytics system for extracting user preferences and insights from rating data.
    This will be used to personalize AI meal recommendations.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def get_rating_db_connection(self):
        """Get isolated database connection for rating analytics"""
        try:
            from ..config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
            import psycopg2
            
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT,
                connect_timeout=10
            )
            return conn
        except Exception as e:
            logger.error(f"Failed to create analytics database connection: {str(e)}")
            raise
    
    def execute_analytics_query(self, query, params=None, fetch_one=False, fetch_all=False):
        """Execute analytics query with isolated connection"""
        conn = None
        try:
            conn = self.get_rating_db_connection()
            conn.autocommit = True
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SET statement_timeout = 30000")  # 30 second timeout
                cur.execute(query, params)
                
                if fetch_one:
                    return cur.fetchone()
                elif fetch_all:
                    return cur.fetchall()
                else:
                    return None
                    
        except Exception as e:
            logger.error(f"Analytics database operation failed: {str(e)}")
            raise
        finally:
            if conn:
                try:
                    conn.close()
                except:
                    pass
    
    def extract_user_preferences(self, user_id: int) -> Dict:
        """
        Extract comprehensive user preferences from rating data
        Returns preference profile for AI integration
        """
        logger.info(f"Extracting preferences for user {user_id}")
        
        try:
            # Get all user ratings with recipe metadata
            user_ratings = self.execute_analytics_query("""
                SELECT 
                    ri.*,
                    sr.title,
                    sr.cuisine,
                    sr.complexity,
                    sr.prep_time,
                    sr.cook_time,
                    sr.total_time,
                    sr.servings
                    -- Removed non-existent columns: ingredients, categories, diet_tags, flavor_profile, spice_level
                FROM recipe_interactions ri
                LEFT JOIN scraped_recipes sr ON ri.recipe_id = sr.id
                WHERE ri.user_id = %s 
                AND ri.rating_score IS NOT NULL
                ORDER BY ri.updated_at DESC
            """, (user_id,), fetch_all=True)
            
            if not user_ratings:
                return self._default_preferences()
            
            # Extract preferences from rating patterns
            preferences = {
                'user_id': user_id,
                'total_ratings': len(user_ratings),
                'average_rating': statistics.mean([r['rating_score'] for r in user_ratings]),
                'cuisine_preferences': self._analyze_cuisine_preferences(user_ratings),
                'complexity_preferences': self._analyze_complexity_preferences(user_ratings),
                'time_preferences': self._analyze_time_preferences(user_ratings),
                'aspect_preferences': self._analyze_aspect_preferences(user_ratings),
                'ingredient_preferences': self._analyze_ingredient_preferences(user_ratings),
                'dietary_preferences': self._analyze_dietary_preferences(user_ratings),
                'flavor_preferences': self._analyze_flavor_preferences(user_ratings),
                'behavioral_insights': self._analyze_behavioral_patterns(user_ratings),
                'last_updated': datetime.now().isoformat()
            }
            
            logger.info(f"Extracted preferences for user {user_id}: {preferences['total_ratings']} ratings analyzed")
            return preferences
            
        except Exception as e:
            logger.error(f"Error extracting preferences for user {user_id}: {str(e)}")
            return self._default_preferences()
    
    def _analyze_cuisine_preferences(self, ratings: List) -> Dict:
        """Analyze cuisine preferences from ratings"""
        cuisine_scores = defaultdict(list)
        
        for rating in ratings:
            if rating['cuisine']:
                cuisine_scores[rating['cuisine']].append(rating['rating_score'])
        
        preferences = {}
        for cuisine, scores in cuisine_scores.items():
            preferences[cuisine] = {
                'average_rating': statistics.mean(scores),
                'count': len(scores),
                'preference_strength': len(scores) * statistics.mean(scores)  # Weight by frequency
            }
        
        # Sort by preference strength
        sorted_cuisines = sorted(preferences.items(), key=lambda x: x[1]['preference_strength'], reverse=True)
        
        return {
            'top_cuisines': [cuisine for cuisine, data in sorted_cuisines[:5]],
            'detailed_scores': dict(sorted_cuisines),
            'diversity_score': len(cuisine_scores)  # How many different cuisines they try
        }
    
    def _analyze_complexity_preferences(self, ratings: List) -> Dict:
        """Analyze complexity/difficulty preferences"""
        complexity_scores = defaultdict(list)
        difficulty_scores = []
        
        for rating in ratings:
            if rating['complexity']:
                complexity_scores[rating['complexity']].append(rating['rating_score'])
            if rating['difficulty_rating']:
                difficulty_scores.append(rating['difficulty_rating'])
        
        # Calculate average preferred difficulty
        preferred_difficulty = statistics.mean(difficulty_scores) if difficulty_scores else None
        
        complexity_prefs = {}
        for complexity, scores in complexity_scores.items():
            complexity_prefs[complexity] = statistics.mean(scores)
        
        return {
            'complexity_scores': complexity_prefs,
            'preferred_difficulty': preferred_difficulty,
            'complexity_tolerance': max(complexity_prefs.values()) - min(complexity_prefs.values()) if complexity_prefs else 0
        }
    
    def _analyze_time_preferences(self, ratings: List) -> Dict:
        """Analyze cooking time preferences"""
        time_ratings = []
        time_accuracy_scores = []
        
        for rating in ratings:
            if rating['total_time'] and rating['rating_score']:
                time_ratings.append({
                    'time': rating['total_time'],
                    'rating': rating['rating_score']
                })
            if rating['time_accuracy']:
                time_accuracy_scores.append(rating['time_accuracy'])
        
        # Group by time ranges
        time_buckets = {
            'quick': [],      # < 30 min
            'medium': [],     # 30-60 min
            'long': []        # > 60 min
        }
        
        for tr in time_ratings:
            if tr['time'] < 30:
                time_buckets['quick'].append(tr['rating'])
            elif tr['time'] <= 60:
                time_buckets['medium'].append(tr['rating'])
            else:
                time_buckets['long'].append(tr['rating'])
        
        time_preferences = {}
        for bucket, ratings in time_buckets.items():
            if ratings:
                time_preferences[bucket] = statistics.mean(ratings)
        
        return {
            'time_bucket_preferences': time_preferences,
            'average_time_accuracy_expectation': statistics.mean(time_accuracy_scores) if time_accuracy_scores else None,
            'preferred_time_range': max(time_preferences, key=time_preferences.get) if time_preferences else 'medium'
        }
    
    def _analyze_aspect_preferences(self, ratings: List) -> Dict:
        """Analyze detailed rating aspects (taste, presentation, etc.)"""
        aspect_scores = defaultdict(list)
        
        for rating in ratings:
            if rating['rating_aspects']:
                try:
                    if isinstance(rating['rating_aspects'], str):
                        aspects = json.loads(rating['rating_aspects'])
                    else:
                        aspects = rating['rating_aspects']
                    
                    for aspect, score in aspects.items():
                        if score > 0:  # Only count rated aspects
                            aspect_scores[aspect].append(score)
                except:
                    continue
        
        aspect_preferences = {}
        for aspect, scores in aspect_scores.items():
            aspect_preferences[aspect] = {
                'average_score': statistics.mean(scores),
                'importance': len(scores),  # How often they rate this aspect
                'consistency': 1 - (statistics.stdev(scores) / 5) if len(scores) > 1 else 1
            }
        
        # Identify most important aspects (frequently rated + high scores)
        importance_ranking = sorted(
            aspect_preferences.items(), 
            key=lambda x: x[1]['importance'] * x[1]['average_score'], 
            reverse=True
        )
        
        return {
            'aspect_scores': aspect_preferences,
            'most_important_aspects': [aspect for aspect, _ in importance_ranking[:3]],
            'aspect_priorities': dict(importance_ranking)
        }
    
    def _analyze_ingredient_preferences(self, ratings: List) -> Dict:
        """Analyze ingredient preferences from highly rated recipes"""
        high_rated_ingredients = []
        low_rated_ingredients = []
        
        for rating in ratings:
            # Skip - ingredients column doesn't exist in scraped_recipes
            # if rating.get('ingredients') and rating['rating_score']:
            #     try:
            #         ingredients = rating['ingredients'] if isinstance(rating['ingredients'], list) else []
            #         
            #         if rating['rating_score'] >= 4:
            #             high_rated_ingredients.extend(ingredients)
            #         elif rating['rating_score'] <= 2:
            #             low_rated_ingredients.extend(ingredients)
            #     except:
            #         continue
            pass
        
        # Count ingredient frequencies
        liked_ingredients = Counter(high_rated_ingredients)
        disliked_ingredients = Counter(low_rated_ingredients)
        
        return {
            'frequently_liked_ingredients': dict(liked_ingredients.most_common(10)),
            'frequently_disliked_ingredients': dict(disliked_ingredients.most_common(5)),
            'ingredient_adventure_score': len(set(high_rated_ingredients)) / max(len(high_rated_ingredients), 1)
        }
    
    def _analyze_dietary_preferences(self, ratings: List) -> Dict:
        """Analyze dietary pattern preferences"""
        diet_scores = defaultdict(list)
        
        for rating in ratings:
            # Skip - diet_tags column doesn't exist in scraped_recipes
            # if rating.get('diet_tags') and rating['rating_score']:
            #     try:
            #         diet_tags = rating['diet_tags'] if isinstance(rating['diet_tags'], dict) else {}
            #         
            #         for diet_type, applicable in diet_tags.items():
            #             if applicable:
            #                 diet_scores[diet_type].append(rating['rating_score'])
            #     except:
            #         continue
            pass
        
        diet_preferences = {}
        for diet_type, scores in diet_scores.items():
            diet_preferences[diet_type] = {
                'average_rating': statistics.mean(scores),
                'frequency': len(scores)
            }
        
        return {
            'dietary_patterns': diet_preferences,
            'dietary_flexibility': len(diet_scores)  # How many different dietary patterns they enjoy
        }
    
    def _analyze_flavor_preferences(self, ratings: List) -> Dict:
        """Analyze flavor profile preferences"""
        flavor_scores = defaultdict(list)
        spice_tolerance = []
        
        for rating in ratings:
            # Skip - flavor_profile and spice_level columns don't exist in scraped_recipes
            # if rating.get('flavor_profile') and rating['rating_score']:
            #     try:
            #         flavors = rating['flavor_profile'] if isinstance(rating['flavor_profile'], dict) else {}
            #         
            #         for flavor, intensity in flavors.items():
            #             if intensity > 0:
            #                 flavor_scores[flavor].append(rating['rating_score'])
            #     except:
            #         continue
            # 
            # if rating.get('spice_level') and rating['rating_score'] >= 4:
            #     spice_tolerance.append(rating['spice_level'])
            pass
        
        flavor_preferences = {}
        for flavor, scores in flavor_scores.items():
            flavor_preferences[flavor] = statistics.mean(scores)
        
        return {
            'flavor_preferences': flavor_preferences,
            'spice_tolerance': max(spice_tolerance) if spice_tolerance else 'mild',
            'flavor_variety': len(flavor_scores)
        }
    
    def _analyze_behavioral_patterns(self, ratings: List) -> Dict:
        """Analyze user rating and cooking behaviors"""
        made_recipes = [r for r in ratings if r['made_recipe']]
        would_remake = [r for r in ratings if r['would_make_again'] is True]
        
        # Calculate engagement metrics
        made_percentage = len(made_recipes) / len(ratings) if ratings else 0
        remake_rate = len(would_remake) / len(made_recipes) if made_recipes else 0
        
        # Rating distribution
        rating_distribution = Counter([r['rating_score'] for r in ratings])
        
        # Rating recency (how recently they've been rating)
        recent_ratings = len([r for r in ratings if 
                            datetime.fromisoformat(r['updated_at'].replace('Z', '+00:00')) > 
                            datetime.now().replace(tzinfo=None) - timedelta(days=30)])
        
        return {
            'cooking_engagement': made_percentage,
            'recipe_satisfaction': remake_rate,
            'rating_generosity': statistics.mean([r['rating_score'] for r in ratings]),
            'rating_distribution': dict(rating_distribution),
            'recent_activity': recent_ratings,
            'total_recipes_made': len(made_recipes),
            'exploration_tendency': len(set([r['recipe_id'] for r in ratings])) / len(ratings) if ratings else 0
        }
    
    def _default_preferences(self) -> Dict:
        """Return default preferences for new users"""
        return {
            'user_id': None,
            'total_ratings': 0,
            'average_rating': 3.0,
            'cuisine_preferences': {'top_cuisines': [], 'diversity_score': 0},
            'complexity_preferences': {'preferred_difficulty': 3},
            'time_preferences': {'preferred_time_range': 'medium'},
            'aspect_preferences': {'most_important_aspects': ['taste', 'ease_of_preparation']},
            'ingredient_preferences': {'ingredient_adventure_score': 0.5},
            'dietary_preferences': {'dietary_flexibility': 0},
            'flavor_preferences': {'spice_tolerance': 'mild'},
            'behavioral_insights': {'cooking_engagement': 0, 'recipe_satisfaction': 0},
            'last_updated': datetime.now().isoformat()
        }
    
    def get_personalization_insights(self, user_id: int) -> Dict:
        """
        Get actionable insights for personalizing AI recommendations
        """
        preferences = self.extract_user_preferences(user_id)
        
        # Generate AI prompt suggestions based on preferences
        prompt_suggestions = []
        
        # Cuisine preferences
        if preferences['cuisine_preferences']['top_cuisines']:
            top_cuisine = preferences['cuisine_preferences']['top_cuisines'][0]
            prompt_suggestions.append(f"User particularly enjoys {top_cuisine} cuisine")
        
        # Complexity preferences
        complexity_prefs = preferences['complexity_preferences']
        if complexity_prefs.get('preferred_difficulty'):
            difficulty = complexity_prefs['preferred_difficulty']
            if difficulty <= 2:
                prompt_suggestions.append("User prefers simple, easy-to-make recipes")
            elif difficulty >= 4:
                prompt_suggestions.append("User enjoys challenging, complex recipes")
        
        # Time preferences
        time_pref = preferences['time_preferences']['preferred_time_range']
        time_suggestions = {
            'quick': "User prefers quick meals (under 30 minutes)",
            'medium': "User is comfortable with moderate cooking times (30-60 minutes)",
            'long': "User enjoys longer cooking projects (over 60 minutes)"
        }
        if time_pref in time_suggestions:
            prompt_suggestions.append(time_suggestions[time_pref])
        
        # Behavioral insights
        behavior = preferences['behavioral_insights']
        if behavior['cooking_engagement'] > 0.7:
            prompt_suggestions.append("User actively cooks and tries new recipes")
        elif behavior['cooking_engagement'] < 0.3:
            prompt_suggestions.append("User prefers recipes that are practical and likely to be made")
        
        return {
            'preferences': preferences,
            'ai_prompt_suggestions': prompt_suggestions,
            'personalization_strength': min(preferences['total_ratings'] / 10, 1.0),  # 0-1 scale
            'recommendation_confidence': 'high' if preferences['total_ratings'] >= 10 else 
                                       'medium' if preferences['total_ratings'] >= 5 else 'low'
        }

# Global analytics instance
rating_analytics = RatingAnalytics()