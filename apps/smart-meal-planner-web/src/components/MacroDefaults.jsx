import { useState, useEffect } from 'react';

// Default values for macros
const DEFAULT_MACROS = {
  protein: 40,   // 40% protein
  carbs: 30,     // 30% carbs
  fat: 30,       // 30% fat
  calories: 2000 // 2000 calories per day
};

export default function MacroDefaults({ initialValues, onChange }) {
  const [macros, setMacros] = useState({
    protein: initialValues?.protein || DEFAULT_MACROS.protein,
    carbs: initialValues?.carbs || DEFAULT_MACROS.carbs,
    fat: initialValues?.fat || DEFAULT_MACROS.fat,
    calories: initialValues?.calories || DEFAULT_MACROS.calories
  });

  useEffect(() => {
    onChange?.(macros);
  }, [macros, onChange]);

  const handleMacroChange = (type, value) => {
    // Allow user to clear field for new input
    if (value === '') {
      setMacros(prev => ({
        ...prev,
        [type]: value
      }));
      return;
    }
    
    // Parse user input
    const newValue = parseInt(value);
    
    // Only use default if input is invalid
    if (isNaN(newValue)) {
      setMacros(prev => ({
        ...prev,
        [type]: DEFAULT_MACROS[type]
      }));
      return;
    }
    
    // Use user's value
    setMacros(prev => ({
      ...prev,
      [type]: newValue
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Protein (%)
          </label>
          <input
            type="number"
            value={macros.protein}
            onChange={(e) => handleMacroChange('protein', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            min="0"
            max="100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Carbs (%)
          </label>
          <input
            type="number"
            value={macros.carbs}
            onChange={(e) => handleMacroChange('carbs', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            min="0"
            max="100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Fat (%)
          </label>
          <input
            type="number"
            value={macros.fat}
            onChange={(e) => handleMacroChange('fat', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            min="0"
            max="100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Daily Calories
          </label>
          <input
            type="number"
            value={macros.calories}
            onChange={(e) => handleMacroChange('calories', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            min="500"
            step="50"
          />
        </div>
      </div>
      
      <div className="text-sm text-gray-500">
        {macros.protein + macros.carbs + macros.fat !== 100 && (
          <p className="text-red-500">
            Macronutrient percentages must total 100%. Current total: 
            {macros.protein + macros.carbs + macros.fat}%
          </p>
        )}
      </div>
    </div>
  );
}