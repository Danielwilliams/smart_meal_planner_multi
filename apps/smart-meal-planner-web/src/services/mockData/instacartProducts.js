/**
 * Mock data for Instacart products search
 * Used as a fallback when the API is unreachable
 */

const mockProductSearchResults = {
  // Common grocery items
  "milk": [
    {
      "id": "milk_1",
      "name": "Organic Whole Milk, 1 Gallon",
      "price": 5.99,
      "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG1pbGslMjBjYXJ0b258ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60",
      "size": "1 gal"
    },
    {
      "id": "milk_2",
      "name": "Low-Fat 2% Milk, Half Gallon",
      "price": 3.49,
      "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8bWlsayUyMGNhcnRvbnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=300&q=60",
      "size": "0.5 gal"
    },
    {
      "id": "milk_3",
      "name": "Almond Milk, Unsweetened, 32 fl oz",
      "price": 4.29,
      "image_url": "https://images.unsplash.com/photo-1556716632-5b6a681a8d8d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8YWxtb25kJTIwbWlsa3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=300&q=60",
      "size": "32 fl oz"
    }
  ],
  "bread": [
    {
      "id": "bread_1",
      "name": "Whole Wheat Bread, 24 oz",
      "price": 3.99,
      "image_url": "https://images.unsplash.com/photo-1598373182133-52452f7691ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGJyZWFkfGVufDB8fDB8fHww&auto=format&fit=crop&w=300&q=60",
      "size": "24 oz"
    },
    {
      "id": "bread_2",
      "name": "White Bread, Family Size, 20 oz",
      "price": 2.99,
      "image_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc7c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8YnJlYWR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60",
      "size": "20 oz"
    }
  ],
  "eggs": [
    {
      "id": "eggs_1",
      "name": "Organic Large Brown Eggs, 12 ct",
      "price": 5.49,
      "image_url": "https://images.unsplash.com/photo-1506976785307-8732e854ad03?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8ZWdnc3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=300&q=60",
      "size": "12 ct"
    },
    {
      "id": "eggs_2",
      "name": "Large White Eggs, 18 ct",
      "price": 4.29,
      "image_url": "https://images.unsplash.com/photo-1566851100058-41d599f05009?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGVnZ3N8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60",
      "size": "18 ct"
    }
  ],
  "cheese": [
    {
      "id": "cheese_1",
      "name": "Sharp Cheddar Cheese, 8 oz Block",
      "price": 4.99,
      "image_url": "https://images.unsplash.com/photo-1618164436241-4473d3af06a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fGNoZWRkYXIlMjBjaGVlc2V8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60",
      "size": "8 oz"
    },
    {
      "id": "cheese_2",
      "name": "Shredded Mozzarella Cheese, 16 oz",
      "price": 4.49,
      "image_url": "https://images.unsplash.com/photo-1588010338550-2af1be1a4244?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGNoZWVzZXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=300&q=60",
      "size": "16 oz"
    }
  ],
  "chicken": [
    {
      "id": "chicken_1",
      "name": "Boneless Skinless Chicken Breasts, 1.5 lbs",
      "price": 7.99,
      "image_url": "https://images.unsplash.com/photo-1599161146800-986e6300a186?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGNoaWNrZW4lMjBicmVhc3R8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60",
      "size": "1.5 lbs"
    },
    {
      "id": "chicken_2",
      "name": "Organic Whole Chicken, 3-4 lbs",
      "price": 12.99,
      "image_url": "https://images.unsplash.com/photo-1587593810167-a84920ea0781?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8Y2hpY2tlbnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=300&q=60",
      "size": "3-4 lbs"
    }
  ]
};

/**
 * Get mock search results for a product query
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Array} Array of matching products
 */
export const getMockProductSearch = (query, limit = 5) => {
  // Normalize the query for matching
  const normalizedQuery = query.toLowerCase().trim();
  
  // Look for an exact match in our mock data
  if (mockProductSearchResults[normalizedQuery]) {
    return mockProductSearchResults[normalizedQuery].slice(0, limit);
  }
  
  // If no exact match, search all products for partial matches
  const allProducts = Object.values(mockProductSearchResults).flat();
  const matchingProducts = allProducts.filter(product => 
    product.name.toLowerCase().includes(normalizedQuery)
  );
  
  // If still no matches, return some default items
  if (matchingProducts.length === 0) {
    // Return a few random products as a fallback
    const randomProducts = [];
    const allProductsArray = Object.values(mockProductSearchResults).flat();
    
    for (let i = 0; i < Math.min(limit, 3); i++) {
      const randomIndex = Math.floor(Math.random() * allProductsArray.length);
      randomProducts.push({
        ...allProductsArray[randomIndex],
        name: `${allProductsArray[randomIndex].name} (similar to "${query}")`,
        id: `${allProductsArray[randomIndex].id}_${i}`
      });
    }
    
    return randomProducts;
  }
  
  return matchingProducts.slice(0, limit);
};

export default mockProductSearchResults;