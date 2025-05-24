// meal_planner_frontend/web/src/pages/LandingPage.jsx
import React from 'react';
import { Box, Typography, Button, Grid, Card, CardContent, CardMedia } from '@mui/material';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' }}>
      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: '60vh', md: '80vh' },
          background: `url("https://images.unsplash.com/photo-1546069901-eacef0df6022?ixid=M3wxfDB8MXxyYW5kb218MHx8Zm9vZCxjb29raW5nfGVufDB8fHx8fDE2ODcwMzg0NTU&ixlib=rb-4.0.3&auto=format&fit=crop&w=1400&q=80") no-repeat center center/cover`
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(0,0,0,0.4)'
          }}
        />
        <Box
          sx={{
            position: 'relative',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: '100%',
            p: 3,
            maxWidth: '800px',
            margin: 'auto'
          }}
        >
          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2 }}>
            Smart Meal Planner
          </Typography>
          <Typography variant="h6" sx={{ mb: 4 }}>
            Unique, nutritious, and flavorful meal plans <br />
            with one-click shopping at your nearest Walmart or Kroger store
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={Link}
            to="/signup"
            sx={{ alignSelf: 'flex-start' }}
          >
            Get Started
          </Button>
        </Box>
      </Box>

      {/* Features Section */}
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1200px', margin: 'auto' }}>
        <Grid container spacing={4} sx={{ my: 4 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
              Flavorful Meals, Zero Hassle
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
              Tired of recycling the same bland recipes every week?
              Smart Meal Planner offers a revolving door of nutritious meals,
              each complete with step-by-step instructions and curated ingredients.
              Our AI ensures you never see the same meal twice—unless you want to!
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
              From family-friendly dinners to quick on-the-go lunches, our system
              combines variety, taste, and diet-friendly ingredients to help you
              enjoy balanced eating without the stress of planning.
            </Typography>
            <Button
              variant="outlined"
              component={Link}
              to="/example-meal-plans"
              sx={{ mt: 2 }}
            >
              Explore Meal Plans
            </Button>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              component="img"
              src="https://images.unsplash.com/photo-1594998893017-36147cbcae05?q=80&w=1786&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="Delicious colorful meal"
              sx={{ width: '100%', borderRadius: 2 }}
            />
          </Grid>
        </Grid>

        <Grid container spacing={4} sx={{ my: 4 }}>
          <Grid item xs={12} md={6} order={{ xs: 2, md: 1 }}>
            <Box
              component="img"
              src="https://plus.unsplash.com/premium_photo-1663091457191-24824b77443c?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="Groceries in cart"
              sx={{ width: '100%', borderRadius: 2 }}
            />
          </Grid>
          <Grid item xs={12} md={6} order={{ xs: 1, md: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
              Automated Grocery Cart
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
              Our app doesn’t just suggest recipes—it also builds your entire
              grocery cart. With a single click, you can send all required
              ingredients to your shopping list at your nearest Walmart or
              Kroger brand store.
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
              Save time, reduce wasted produce, and pick up exactly what you
              need—no more, no less. Whether you’re cooking for one or meal-prepping
              for a big family, the entire process is streamlined from the
              ingredient list right down to your checkout lane.
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* Highlights Section */}
      <Box sx={{ bgcolor: 'background.paper', py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', textAlign: 'center', mb: 4 }}>
          Why Choose Smart Meal Planner?
        </Typography>
        <Grid container spacing={2} sx={{ maxWidth: '1200px', margin: 'auto', px: 2 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ textAlign: 'center' }}>
              <CardMedia
                component="img"
                height="200"
                image="https://plus.unsplash.com/premium_photo-1695028377773-e3673040f2cc?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Unique recipes"
              />
              <CardContent>
                <Typography variant="h6">Endless Variety</Typography>
                <Typography variant="body2">
                  Our AI ensures you always have fresh meal ideas that suit your palate.
                  No more dull repeats or guesswork.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ textAlign: 'center' }}>
              <CardMedia
                component="img"
                height="200"
                image="https://images.unsplash.com/photo-1600891964599-f61ba0e24092?ixid=M3wxfDB8MXxyYW5kb218MHx8Zm9vZCxkaWV0fHx8fHx8fDE2ODcwNDA1NzU&ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
                alt="Healthy variety"
              />
              <CardContent>
                <Typography variant="h6">Nutritious & Balanced</Typography>
                <Typography variant="body2">
                  Our system tailors meals around your dietary preferences. 
                  Keto, Vegan, Low-Carb, or anything in-between.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ textAlign: 'center' }}>
              <CardMedia
                component="img"
                height="200"
                image="https://images.unsplash.com/photo-1601598851547-4302969d0614?q=80&w=1964&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Shopping cart"
              />
              <CardContent>
                <Typography variant="h6">One-Click Shopping</Typography>
                <Typography variant="body2">
                  Generate a complete grocery list for Walmart or Kroger near you.
                  Get your ingredients quickly, hassle-free.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Final CTA */}
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Ready to Transform Your Meals?
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, mx: 'auto', maxWidth: 700, lineHeight: 1.7 }}>
          Sign up now and explore a world of unique, tasty meals designed
          around your lifestyle. From swift grocery ordering at your
          local Walmart or Kroger to step-by-step cooking instructions—
          your new culinary journey starts here.
        </Typography>
        <Button variant="contained" size="large" component={Link} to="/signup">
          Sign Up for Free
        </Button>
      </Box>
    </Box>
  );
}

export default LandingPage;
