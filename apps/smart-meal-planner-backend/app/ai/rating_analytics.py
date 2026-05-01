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
    
    def get_recent_preference_shifts(self, user_id: int, days: int = 30) -> Dict:
        """
        Detect recent changes in user preferences by comparing recent ratings vs historical patterns
        """
        logger.info(f"Analyzing preference shifts for user {user_id} over last {days} days")
        
        try:
            # Get cutoff date for recent ratings
            from datetime import datetime, timedelta
            cutoff_date = datetime.now() - timedelta(days=days)
            
            # Get recent ratings
            recent_ratings = self.execute_analytics_query("""
                SELECT 
                    ri.*,
                    sr.title,
                    sr.cuisine,
                    sr.complexity,
                    sr.prep_time,
                    sr.cook_time,
                    sr.total_time,
                    sr.servings
                FROM recipe_interactions ri
                LEFT JOIN scraped_recipes sr ON ri.recipe_id = sr.id
                WHERE ri.user_id = %s 
                AND ri.rating_score IS NOT NULL
                AND ri.updated_at >= %s
                ORDER BY ri.updated_at DESC
            """, (user_id, cutoff_date), fetch_all=True)
            
            # Get historical ratings (older than the cutoff)
            historical_ratings = self.execute_analytics_query("""
                SELECT 
                    ri.*,
                    sr.title,
                    sr.cuisine,
                    sr.complexity,
                    sr.prep_time,
                    sr.cook_time,
                    sr.total_time,
                    sr.servings
                FROM recipe_interactions ri
                LEFT JOIN scraped_recipes sr ON ri.recipe_id = sr.id
                WHERE ri.user_id = %s 
                AND ri.rating_score IS NOT NULL
                AND ri.updated_at < %s
                ORDER BY ri.updated_at DESC
                LIMIT 50
            """, (user_id, cutoff_date), fetch_all=True)
            
            if not recent_ratings or len(recent_ratings) < 3:
                return {
                    'shifts_detected': False,
                    'reason': 'Insufficient recent ratings for comparison',
                    'recent_count': len(recent_ratings),
                    'historical_count': len(historical_ratings)
                }
            
            if not historical_ratings or len(historical_ratings) < 5:
                return {
                    'shifts_detected': False,
                    'reason': 'Insufficient historical data for comparison',
                    'recent_count': len(recent_ratings),
                    'historical_count': len(historical_ratings)
                }
            
            # Analyze different types of shifts
            shifts = {
                'shifts_detected': False,
                'recent_count': len(recent_ratings),
                'historical_count': len(historical_ratings),
                'cuisine_shifts': self._detect_cuisine_shifts(recent_ratings, historical_ratings),
                'complexity_shifts': self._detect_complexity_shifts(recent_ratings, historical_ratings),
                'satisfaction_trends': self._analyze_satisfaction_trends(recent_ratings, historical_ratings),
                'new_interests': self._detect_new_cuisine_interests(recent_ratings, historical_ratings),
                'time_preference_shifts': self._detect_time_preference_shifts(recent_ratings, historical_ratings)
            }
            
            # Determine if any significant shifts were detected
            significant_shifts = []
            if shifts['cuisine_shifts']['significant_changes']:
                significant_shifts.extend(shifts['cuisine_shifts']['changes'])
            if shifts['complexity_shifts']['significant_change']:
                significant_shifts.append(shifts['complexity_shifts']['description'])
            if shifts['satisfaction_trends']['trend'] != 'stable':
                significant_shifts.append(shifts['satisfaction_trends']['description'])
            if shifts['new_interests']:
                significant_shifts.extend([f"New interest in {cuisine}" for cuisine in shifts['new_interests']])
            if shifts['time_preference_shifts']['significant_change']:
                significant_shifts.append(shifts['time_preference_shifts']['description'])
            
            shifts['shifts_detected'] = len(significant_shifts) > 0
            shifts['significant_changes'] = significant_shifts
            
            logger.info(f"Preference shifts analysis complete: {len(significant_shifts)} changes detected")
            return shifts
            
        except Exception as e:
            logger.error(f"Error analyzing preference shifts for user {user_id}: {str(e)}")
            return {
                'shifts_detected': False,
                'reason': f'Error during analysis: {str(e)}',
                'recent_count': 0,
                'historical_count': 0
            }
    
    def _detect_cuisine_shifts(self, recent_ratings: List, historical_ratings: List) -> Dict:
        """Detect shifts in cuisine preferences"""
        # Calculate cuisine averages for recent vs historical
        recent_cuisine_scores = defaultdict(list)
        historical_cuisine_scores = defaultdict(list)
        
        for rating in recent_ratings:
            if rating['cuisine']:
                recent_cuisine_scores[rating['cuisine']].append(rating['rating_score'])
        
        for rating in historical_ratings:
            if rating['cuisine']:
                historical_cuisine_scores[rating['cuisine']].append(rating['rating_score'])
        
        # Calculate average ratings for each cuisine in both periods
        recent_avgs = {cuisine: statistics.mean(scores) for cuisine, scores in recent_cuisine_scores.items()}
        historical_avgs = {cuisine: statistics.mean(scores) for cuisine, scores in historical_cuisine_scores.items() if len(scores) >= 2}
        
        # Look for significant changes (> 1.0 rating difference)
        changes = []
        for cuisine in recent_avgs:
            if cuisine in historical_avgs:
                diff = recent_avgs[cuisine] - historical_avgs[cuisine]
                if abs(diff) > 1.0:  # Significant change threshold
                    if diff > 0:
                        changes.append(f"Increased interest in {cuisine} cuisine (+{diff:.1f} stars)")
                    else:
                        changes.append(f"Decreased interest in {cuisine} cuisine ({diff:.1f} stars)")
        
        return {
            'significant_changes': len(changes) > 0,
            'changes': changes,
            'recent_cuisines': list(recent_avgs.keys()),
            'trending_up': [c for c, diff in [(cuisine, recent_avgs[cuisine] - historical_avgs.get(cuisine, 0)) 
                                             for cuisine in recent_avgs] if diff > 1.0],
            'trending_down': [c for c, diff in [(cuisine, recent_avgs[cuisine] - historical_avgs.get(cuisine, 0)) 
                                               for cuisine in recent_avgs] if diff < -1.0]
        }
    
    def _detect_complexity_shifts(self, recent_ratings: List, historical_ratings: List) -> Dict:
        """Detect changes in complexity preferences"""
        recent_complexity = [r['difficulty_rating'] for r in recent_ratings if r.get('difficulty_rating')]
        historical_complexity = [r['difficulty_rating'] for r in historical_ratings if r.get('difficulty_rating')]
        
        if not recent_complexity or not historical_complexity:
            return {'significant_change': False, 'description': 'Insufficient complexity rating data'}
        
        recent_avg = statistics.mean(recent_complexity)
        historical_avg = statistics.mean(historical_complexity)
        diff = recent_avg - historical_avg
        
        if abs(diff) > 0.8:  # Significant change in difficulty preference
            if diff > 0:
                return {
                    'significant_change': True,
                    'description': f"Preferring more complex recipes recently (+{diff:.1f} difficulty)",
                    'trend': 'more_complex'
                }
            else:
                return {
                    'significant_change': True,
                    'description': f"Preferring simpler recipes recently ({diff:.1f} difficulty)",
                    'trend': 'simpler'
                }
        
        return {'significant_change': False, 'trend': 'stable'}
    
    def _analyze_satisfaction_trends(self, recent_ratings: List, historical_ratings: List) -> Dict:
        """Analyze overall satisfaction trends"""
        recent_scores = [r['rating_score'] for r in recent_ratings]
        historical_scores = [r['rating_score'] for r in historical_ratings]
        
        recent_avg = statistics.mean(recent_scores)
        historical_avg = statistics.mean(historical_scores)
        diff = recent_avg - historical_avg
        
        if abs(diff) > 0.5:  # Significant satisfaction change
            if diff > 0:
                return {
                    'trend': 'improving',
                    'description': f"Rating satisfaction improving recently (+{diff:.1f} stars)",
                    'recent_avg': recent_avg,
                    'historical_avg': historical_avg
                }
            else:
                return {
                    'trend': 'declining',
                    'description': f"Rating satisfaction declining recently ({diff:.1f} stars)",
                    'recent_avg': recent_avg,
                    'historical_avg': historical_avg
                }
        
        return {
            'trend': 'stable',
            'description': 'Satisfaction levels remain stable',
            'recent_avg': recent_avg,
            'historical_avg': historical_avg
        }
    
    def _detect_new_cuisine_interests(self, recent_ratings: List, historical_ratings: List) -> List[str]:
        """Detect new cuisines the user has started trying and rating highly"""
        recent_cuisines = set(r['cuisine'] for r in recent_ratings if r['cuisine'] and r['rating_score'] >= 4)
        historical_cuisines = set(r['cuisine'] for r in historical_ratings if r['cuisine'])
        
        # Find cuisines that are new in recent period and highly rated
        new_cuisines = recent_cuisines - historical_cuisines
        return list(new_cuisines)
    
    def _detect_time_preference_shifts(self, recent_ratings: List, historical_ratings: List) -> Dict:
        """Detect changes in time/convenience preferences"""
        # Analyze prep time preferences
        recent_times = [r['total_time'] for r in recent_ratings if r.get('total_time') and r['rating_score'] >= 4]
        historical_times = [r['total_time'] for r in historical_ratings if r.get('total_time') and r['rating_score'] >= 4]
        
        if not recent_times or not historical_times or len(recent_times) < 3:
            return {'significant_change': False, 'description': 'Insufficient time preference data'}
        
        recent_avg = statistics.mean(recent_times)
        historical_avg = statistics.mean(historical_times)
        diff = recent_avg - historical_avg
        
        if abs(diff) > 15:  # 15+ minute difference is significant
            if diff > 0:
                return {
                    'significant_change': True,
                    'description': f"Recently preferring longer cooking times (+{diff:.0f} min)",
                    'trend': 'longer_times'
                }
            else:
                return {
                    'significant_change': True,
                    'description': f"Recently preferring quicker meals ({diff:.0f} min)",
                    'trend': 'quicker_meals'
                }
        
        return {'significant_change': False, 'trend': 'stable'}
    
    def get_saved_recipes_insights(self, user_id: int) -> Dict:
        """
        Analyze user's saved recipes to provide insights for menu generation
        """
        logger.info(f"Analyzing saved recipes for user {user_id}")
        
        try:
            # Get saved recipes with full details
            saved_recipes = self.execute_analytics_query("""
                SELECT 
                    sr.recipe_name,
                    sr.recipe_source,
                    sr.ingredients,
                    sr.instructions,
                    sr.macros,
                    sr.complexity_level,
                    sr.appliance_used,
                    sr.servings,
                    sr.prep_time,
                    sr.created_at,
                    sr.notes,
                    -- Get cuisine info from scraped_recipes if available
                    scr.cuisine,
                    scr.title as original_title
                FROM saved_recipes sr
                LEFT JOIN scraped_recipes scr ON sr.scraped_recipe_id = scr.id
                WHERE sr.user_id = %s
                ORDER BY sr.created_at DESC
            """, (user_id,), fetch_all=True)
            
            if not saved_recipes:
                return {
                    'has_saved_recipes': False,
                    'total_saved': 0,
                    'insights': [],
                    'recommendations': []
                }
            
            # Analyze saved recipe patterns
            insights = {
                'has_saved_recipes': True,
                'total_saved': len(saved_recipes),
                'recent_saves': len([r for r in saved_recipes if self._is_recent(r['created_at'], days=30)]),
                'cuisine_patterns': self._analyze_saved_recipe_cuisines(saved_recipes),
                'complexity_patterns': self._analyze_saved_recipe_complexity(saved_recipes),
                'ingredient_patterns': self._analyze_saved_recipe_ingredients(saved_recipes),
                'time_patterns': self._analyze_saved_recipe_timing(saved_recipes),
                'recipe_suggestions': self._generate_similar_recipe_suggestions(saved_recipes),
                'menu_integration_opportunities': self._identify_menu_integration_opportunities(saved_recipes)
            }
            
            # Generate AI prompt suggestions based on saved recipes
            ai_suggestions = []
            
            # Cuisine preferences from saved recipes
            if insights['cuisine_patterns']['top_cuisines']:
                ai_suggestions.append(f"User saves recipes from: {', '.join(insights['cuisine_patterns']['top_cuisines'][:3])}")
            
            # Complexity preferences
            if insights['complexity_patterns']['preferred_complexity']:
                ai_suggestions.append(f"User prefers {insights['complexity_patterns']['preferred_complexity']} complexity recipes")
            
            # Timing preferences  
            if insights['time_patterns']['preferred_prep_time_range']:
                ai_suggestions.append(f"User saves recipes with {insights['time_patterns']['preferred_prep_time_range']} prep time")
            
            # Recent activity
            if insights['recent_saves'] > 0:
                ai_suggestions.append(f"User has saved {insights['recent_saves']} recipes recently - showing active interest")
            
            insights['ai_prompt_suggestions'] = ai_suggestions
            
            # 🍽️ NEW: Format actual saved recipes as AI examples
            insights['recipe_examples'] = self._format_saved_recipes_for_ai(saved_recipes)
            insights['direct_use_recipes'] = self._select_recipes_for_direct_use(saved_recipes)
            
            logger.info(f"Saved recipes analysis complete: {insights['total_saved']} saved recipes, {len(ai_suggestions)} insights")
            return insights
            
        except Exception as e:
            logger.error(f"Error analyzing saved recipes for user {user_id}: {str(e)}")
            return {
                'has_saved_recipes': False,
                'total_saved': 0,
                'error': str(e)
            }
    
    def _is_recent(self, date_str, days: int = 30) -> bool:
        """Check if a date is within the last N days"""
        try:
            from datetime import datetime, timedelta
            if isinstance(date_str, str):
                date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                date_obj = date_str
            cutoff = datetime.now().replace(tzinfo=None) - timedelta(days=days)
            return date_obj.replace(tzinfo=None) > cutoff
        except:
            return False
    
    def _analyze_saved_recipe_cuisines(self, saved_recipes: List) -> Dict:
        """Analyze cuisine patterns in saved recipes"""
        cuisines = [r['cuisine'] for r in saved_recipes if r.get('cuisine')]
        cuisine_counts = Counter(cuisines)
        
        return {
            'top_cuisines': [cuisine for cuisine, count in cuisine_counts.most_common(5)],
            'cuisine_diversity': len(set(cuisines)),
            'cuisine_distribution': dict(cuisine_counts.most_common(10))
        }
    
    def _analyze_saved_recipe_complexity(self, saved_recipes: List) -> Dict:
        """Analyze complexity patterns in saved recipes"""
        complexities = [r['complexity_level'] for r in saved_recipes if r.get('complexity_level')]
        complexity_counts = Counter(complexities)
        
        # Map complexity to preference
        preferred = complexity_counts.most_common(1)[0][0] if complexity_counts else None
        
        return {
            'preferred_complexity': preferred,
            'complexity_distribution': dict(complexity_counts),
            'variety_in_complexity': len(set(complexities))
        }
    
    def _analyze_saved_recipe_ingredients(self, saved_recipes: List) -> Dict:
        """Analyze ingredient patterns in saved recipes"""
        all_ingredients = []
        
        for recipe in saved_recipes:
            if recipe.get('ingredients') and isinstance(recipe['ingredients'], list):
                for ingredient in recipe['ingredients']:
                    if isinstance(ingredient, dict) and 'name' in ingredient:
                        all_ingredients.append(ingredient['name'].lower())
                    elif isinstance(ingredient, str):
                        all_ingredients.append(ingredient.lower())
        
        ingredient_counts = Counter(all_ingredients)
        
        return {
            'common_ingredients': [ing for ing, count in ingredient_counts.most_common(10)],
            'total_unique_ingredients': len(set(all_ingredients)),
            'ingredient_frequency': dict(ingredient_counts.most_common(15))
        }
    
    def _analyze_saved_recipe_timing(self, saved_recipes: List) -> Dict:
        """Analyze timing patterns in saved recipes"""
        prep_times = [r['prep_time'] for r in saved_recipes if r.get('prep_time') and r['prep_time'] > 0]
        
        if not prep_times:
            return {'preferred_prep_time_range': 'unknown'}
        
        avg_prep_time = statistics.mean(prep_times)
        
        if avg_prep_time <= 20:
            time_range = 'quick (≤20 min)'
        elif avg_prep_time <= 45:
            time_range = 'moderate (20-45 min)'
        else:
            time_range = 'longer (45+ min)'
        
        return {
            'preferred_prep_time_range': time_range,
            'average_prep_time': avg_prep_time,
            'prep_time_distribution': {
                'quick': len([t for t in prep_times if t <= 20]),
                'moderate': len([t for t in prep_times if 20 < t <= 45]),
                'longer': len([t for t in prep_times if t > 45])
            }
        }
    
    def _generate_similar_recipe_suggestions(self, saved_recipes: List) -> List[str]:
        """Generate suggestions for similar recipes based on saved patterns"""
        suggestions = []
        
        # Analyze common ingredients
        all_ingredients = []
        for recipe in saved_recipes:
            if recipe.get('ingredients'):
                for ingredient in recipe['ingredients']:
                    if isinstance(ingredient, dict) and 'name' in ingredient:
                        all_ingredients.append(ingredient['name'])
        
        common_ingredients = [ing for ing, count in Counter(all_ingredients).most_common(5)]
        
        if common_ingredients:
            suggestions.append(f"Consider recipes featuring: {', '.join(common_ingredients[:3])}")
        
        # Analyze recipe names for patterns
        recipe_names = [r['recipe_name'] for r in saved_recipes if r.get('recipe_name')]
        
        # Look for common cooking methods or recipe types
        cooking_methods = []
        for name in recipe_names:
            name_lower = name.lower()
            if 'stir fry' in name_lower or 'stir-fry' in name_lower:
                cooking_methods.append('stir-fry')
            elif 'roasted' in name_lower or 'roast' in name_lower:
                cooking_methods.append('roasted')
            elif 'grilled' in name_lower:
                cooking_methods.append('grilled')
            elif 'pasta' in name_lower:
                cooking_methods.append('pasta')
            elif 'soup' in name_lower:
                cooking_methods.append('soup')
        
        common_methods = [method for method, count in Counter(cooking_methods).most_common(3)]
        if common_methods:
            suggestions.append(f"User enjoys {', '.join(common_methods)} style recipes")
        
        return suggestions
    
    def _identify_menu_integration_opportunities(self, saved_recipes: List) -> List[Dict]:
        """Identify opportunities to integrate saved recipes into menu generation"""
        opportunities = []
        
        # Recent saves that could be directly included
        recent_recipes = [r for r in saved_recipes if self._is_recent(r['created_at'], days=60)]
        
        if recent_recipes:
            opportunities.append({
                'type': 'direct_inclusion',
                'description': f'Include {len(recent_recipes)} recently saved recipes directly in menus',
                'recipes': [r['recipe_name'] for r in recent_recipes[:5]],
                'priority': 'high'
            })
        
        # Highly saved ingredients for new recipe generation
        ingredient_patterns = self._analyze_saved_recipe_ingredients(saved_recipes)
        if ingredient_patterns['common_ingredients']:
            opportunities.append({
                'type': 'ingredient_based_generation',
                'description': f"Generate new recipes using user's favorite ingredients",
                'ingredients': ingredient_patterns['common_ingredients'][:5],
                'priority': 'medium'
            })
        
        # Cuisine expansion based on saved patterns
        cuisine_patterns = self._analyze_saved_recipe_cuisines(saved_recipes)
        if cuisine_patterns['top_cuisines']:
            opportunities.append({
                'type': 'cuisine_expansion',
                'description': f"Explore variations within preferred cuisines",
                'cuisines': cuisine_patterns['top_cuisines'][:3],
                'priority': 'medium'
            })
        
        return opportunities
    
    def _format_saved_recipes_for_ai(self, saved_recipes: List) -> Dict:
        """
        Format saved recipes as examples for AI to use as inspiration
        """
        if not saved_recipes:
            return {'examples': [], 'formatted_examples': ''}
        
        # Select the most relevant recipes (recent + diverse)
        recent_recipes = [r for r in saved_recipes if self._is_recent(r['created_at'], days=60)][:8]
        if len(recent_recipes) < 5:
            # Add some older recipes if we don't have enough recent ones
            older_recipes = [r for r in saved_recipes if not self._is_recent(r['created_at'], days=60)][:5]
            recent_recipes.extend(older_recipes)
        
        formatted_examples = []
        for recipe in recent_recipes[:8]:  # Limit to 8 examples to keep token usage reasonable
            try:
                # Parse ingredients if they're in JSON format
                ingredients_list = []
                if recipe['ingredients']:
                    if isinstance(recipe['ingredients'], str):
                        import json
                        ingredients_data = json.loads(recipe['ingredients'])
                    else:
                        ingredients_data = recipe['ingredients']
                    
                    # Extract ingredient names
                    if isinstance(ingredients_data, list):
                        for ing in ingredients_data:
                            if isinstance(ing, dict):
                                ingredients_list.append(ing.get('name', str(ing)))
                            else:
                                ingredients_list.append(str(ing))
                
                # Format as AI example
                example = {
                    'title': recipe['recipe_name'] or recipe.get('original_title', 'Saved Recipe'),
                    'cuisine': recipe.get('cuisine', 'Unknown'),
                    'complexity': recipe.get('complexity_level', 'medium'),
                    'prep_time': recipe.get('prep_time', 'unknown'),
                    'servings': recipe.get('servings', 4),
                    'main_ingredients': ingredients_list[:8],  # Top 8 ingredients
                    'appliance': recipe.get('appliance_used'),
                    'notes': recipe.get('notes', ''),
                    'source': 'user_saved'
                }
                formatted_examples.append(example)
                
            except Exception as e:
                logger.warning(f"Error formatting saved recipe: {str(e)}")
                continue
        
        # Create formatted text for AI prompt
        ai_prompt_text = ""
        if formatted_examples:
            ai_prompt_text = "USER'S SAVED RECIPES (use as inspiration):\n"
            for i, example in enumerate(formatted_examples, 1):
                ai_prompt_text += f"{i}. **{example['title']}** ({example['cuisine']} cuisine)\n"
                ai_prompt_text += f"   • Complexity: {example['complexity']}\n"
                if example['prep_time'] != 'unknown':
                    ai_prompt_text += f"   • Prep time: {example['prep_time']} min\n"
                if example['main_ingredients']:
                    ingredients_str = ', '.join(example['main_ingredients'])
                    ai_prompt_text += f"   • Key ingredients: {ingredients_str}\n"
                if example['appliance']:
                    ai_prompt_text += f"   • Uses: {example['appliance']}\n"
                ai_prompt_text += "\n"
        
        return {
            'examples': formatted_examples,
            'formatted_examples': ai_prompt_text,
            'count': len(formatted_examples)
        }
    
    def _select_recipes_for_direct_use(self, saved_recipes: List) -> Dict:
        """
        Select saved recipes that can be used directly in meal plans
        """
        if not saved_recipes:
            return {'direct_recipes': [], 'suggestions': ''}
        
        # Select recipes that are well-suited for direct inclusion
        suitable_recipes = []
        for recipe in saved_recipes[:15]:  # Check most recent 15
            # Criteria for direct use: has clear ingredients, reasonable complexity
            if (recipe['ingredients'] and 
                recipe['recipe_name'] and
                recipe.get('complexity_level') in ['easy', 'medium', 'complex', None]):
                
                try:
                    # Parse ingredients to ensure they're usable
                    if isinstance(recipe['ingredients'], str):
                        import json
                        ingredients_data = json.loads(recipe['ingredients'])
                    else:
                        ingredients_data = recipe['ingredients']
                    
                    if ingredients_data and len(ingredients_data) >= 3:  # At least 3 ingredients
                        suitable_recipes.append({
                            'title': recipe['recipe_name'],
                            'cuisine': recipe.get('cuisine', 'American'),
                            'complexity': recipe.get('complexity_level', 'medium'),
                            'prep_time': recipe.get('prep_time', 30),
                            'servings': recipe.get('servings', 4),
                            'appliance': recipe.get('appliance_used'),
                            'ingredients': ingredients_data,
                            'instructions': recipe.get('instructions'),
                            'macros': recipe.get('macros'),
                            'notes': recipe.get('notes', ''),
                            'created_at': recipe['created_at']
                        })
                        
                except Exception as e:
                    logger.warning(f"Error processing recipe for direct use: {str(e)}")
                    continue
        
        # Sort by recency and limit
        suitable_recipes = sorted(suitable_recipes, 
                                key=lambda x: x['created_at'], reverse=True)[:5]
        
        # Create suggestions text
        suggestions = ""
        if suitable_recipes:
            suggestions = f"DIRECT RECIPE SUGGESTIONS ({len(suitable_recipes)} available):\n"
            suggestions += "• Include 1-2 of these saved recipes directly in the meal plan\n"
            suggestions += "• User has actively saved these - high likelihood they'll actually cook them\n"
            recipe_names = [r['title'] for r in suitable_recipes]
            suggestions += f"• Available: {', '.join(recipe_names[:3])}"
            if len(recipe_names) > 3:
                suggestions += f" and {len(recipe_names)-3} more"
            suggestions += "\n"
        
        return {
            'direct_recipes': suitable_recipes,
            'suggestions': suggestions,
            'count': len(suitable_recipes)
        }

# Global analytics instance
rating_analytics = RatingAnalytics()