import React from 'react';

const SmartIngredientDisplay = ({ ingredient }) => {
  // Helper function to parse ingredient string
  const parseIngredient = (ingStr) => {
    // Remove any leading "1 piece" or variations
    const cleanStr = ingStr.replace(/^1\s*piece\s*/i, '').trim();
    console.log('After 1 piece removal:', cleanStr);
    return cleanStr;
  };

  // Clean and store the ingredient string
  const displayStr = parseIngredient(ingredient);

  return (
    <div className="text-base">
      {displayStr}
    </div>
  );
};

export default SmartIngredientDisplay;
