/**
 * Mock data for Instacart retailers
 * Used as a fallback when the API is unreachable
 */

const mockRetailers = [
  {
    "id": "retailer_1",
    "name": "Publix",
    "logo_url": "https://www.instacart.com/assets/retailers/publix-e789c7f99e6f207eb5f4f151c6a1ac12.png",
    "address": {
      "street": "123 Main St",
      "city": "Loveland",
      "state": "CO",
      "zip_code": "80538",
      "country": "US"
    },
    "distance": 2.4
  },
  {
    "id": "retailer_2",
    "name": "Kroger",
    "logo_url": "https://www.instacart.com/assets/retailers/kroger-93839185d7df6173eb9c6dd8cd895351.png",
    "address": {
      "street": "456 Oak Ave",
      "city": "Loveland",
      "state": "CO",
      "zip_code": "80538",
      "country": "US"
    },
    "distance": 3.1
  },
  {
    "id": "retailer_3",
    "name": "Sprouts Farmers Market",
    "logo_url": "https://www.instacart.com/assets/retailers/sprouts-a1e986d41a5cc2bec47e24e2d98c1d47.png",
    "address": {
      "street": "789 Pine St",
      "city": "Loveland",
      "state": "CO",
      "zip_code": "80538",
      "country": "US"
    },
    "distance": 4.5
  },
  {
    "id": "retailer_4",
    "name": "Whole Foods",
    "logo_url": "https://www.instacart.com/assets/retailers/whole-foods-market-74e61c5e1510d0b95750c1c40d019733.png",
    "address": {
      "street": "101 Maple Rd",
      "city": "Fort Collins",
      "state": "CO",
      "zip_code": "80525",
      "country": "US"
    },
    "distance": 8.2
  },
  {
    "id": "retailer_5",
    "name": "Target",
    "logo_url": "https://www.instacart.com/assets/retailers/target-1e24131a12df755e893076cb0c9ab91c.png",
    "address": {
      "street": "202 Cedar Ln",
      "city": "Loveland",
      "state": "CO",
      "zip_code": "80538",
      "country": "US"
    },
    "distance": 5.7
  },
  {
    "id": "retailer_6",
    "name": "Safeway",
    "logo_url": "https://www.instacart.com/assets/retailers/safeway-9f841dafa88478201a0a8918ac2c9c6c.png",
    "address": {
      "street": "303 Birch Blvd",
      "city": "Loveland",
      "state": "CO",
      "zip_code": "80538",
      "country": "US"
    },
    "distance": 4.1
  },
  {
    "id": "retailer_7",
    "name": "Costco",
    "logo_url": "https://www.instacart.com/assets/retailers/costco-b22e88fd90eee9d842fa03762ac6ebf9.png",
    "address": {
      "street": "404 Elm St",
      "city": "Fort Collins",
      "state": "CO",
      "zip_code": "80525",
      "country": "US"
    },
    "distance": 9.3
  },
  {
    "id": "retailer_8",
    "name": "Albertsons",
    "logo_url": "https://www.instacart.com/assets/retailers/albertsons-f2d6ccd1cfa27314d6a6f115065082d0.png",
    "address": {
      "street": "505 Aspen Ave",
      "city": "Loveland",
      "state": "CO",
      "zip_code": "80538",
      "country": "US"
    },
    "distance": 3.8
  }
];

/**
 * Generate mock retailers based on ZIP code
 * @param {string} zipCode - ZIP code to filter retailers by
 * @returns {Array} Filtered list of retailers
 */
export const getMockRetailersByZip = (zipCode) => {
  // Simple filtering based on the first digit of the ZIP code
  // This is just for demonstration purposes
  const zipPrefix = zipCode ? zipCode.charAt(0) : '8';
  
  // Filter and adjust distances based on ZIP code
  const filteredRetailers = mockRetailers.map(retailer => {
    // Create a shallow copy of the retailer
    const modifiedRetailer = { ...retailer };
    
    // Adjust the address to match the provided ZIP code
    if (modifiedRetailer.address) {
      modifiedRetailer.address = {
        ...modifiedRetailer.address,
        zip_code: zipCode || '80538'
      };
    }
    
    // Adjust the distance based on the ZIP code prefix
    // This creates a deterministic but different ordering for different ZIP codes
    const baseDist = modifiedRetailer.distance;
    const zipAdjustment = (parseInt(zipPrefix) % 5) / 10; // Small adjustment between 0 and 0.4
    modifiedRetailer.distance = Math.round((baseDist + zipAdjustment) * 10) / 10;
    
    return modifiedRetailer;
  });
  
  // Sort by distance
  return filteredRetailers.sort((a, b) => a.distance - b.distance);
};

export default mockRetailers;