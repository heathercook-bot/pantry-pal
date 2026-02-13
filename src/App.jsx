import React, { useState, useMemo } from 'react';
import { 
  ChefHat, 
  ShoppingBasket, 
  Utensils, 
  Plus, 
  X, 
  Trash2, 
  Search, 
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  Lightbulb,
  Calendar,
  ChevronRight,
  MinusCircle,
  Maximize2,
  ClipboardPaste,
  ArrowLeft,
  ArrowRightLeft,
  StickyNote,
  Save,
  Pencil
} from 'lucide-react';

// --- Gemini API Setup ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const callGemini = async (prompt, systemInstruction = "") => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with the AI Chef. Please try again.";
  }
};

// --- Mock Data ---
const INITIAL_PANTRY = [
  'eggs', 'milk', 'butter', 'flour', 'sugar', 'salt', 'pepper', 'garlic', 'onion', 'pasta', 'tomato sauce', 'beef', 'cabbage', 'soy sauce'
];

const INITIAL_RECIPES = [
  {
    id: 1,
    name: 'Turkey Egg Roll Bowl',
    ingredients: ['ground beef', 'coleslaw mix', 'soy sauce', 'ginger', 'garlic', 'onion'],
    instructions: '1. Brown the meat with onion and garlic.\n2. Add coleslaw mix and cook until wilted.\n3. Stir in soy sauce and ginger.\n4. Serve over rice or on its own.',
    type: 'Dinner',
    notes: 'Great for meal prep!'
  },
  {
    id: 2,
    name: 'Classic Burgers',
    ingredients: ['ground beef', 'buns', 'cheese', 'lettuce', 'tomato', 'onion'],
    instructions: '1. Form ground beef into patties.\n2. Season with salt and pepper.\n3. Grill or pan fry for 4-5 mins per side.\n4. Toast buns and assemble with toppings.',
    type: 'Dinner',
    notes: ''
  },
  {
    id: 3,
    name: 'Scrambled Eggs',
    ingredients: ['eggs', 'milk', 'butter', 'salt', 'pepper'],
    instructions: '1. Crack eggs into a bowl.\n2. Add a splash of milk and whisk.\n3. Melt butter in a non-stick pan.\n4. Pour in eggs and cook gently, stirring constantly.',
    type: 'Breakfast',
    notes: 'Add cheese at the end.'
  },
  {
    id: 4,
    name: 'Simple Pasta',
    ingredients: ['pasta', 'tomato sauce', 'garlic', 'onion', 'salt'],
    instructions: '1. Boil salted water and cook pasta.\n2. Meanwhile, sauté chopped garlic and onion.\n3. Add tomato sauce and simmer.\n4. Drain pasta and toss with sauce.',
    type: 'Dinner',
    notes: ''
  }
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// --- Utility Functions for Smart Matching ---
const normalize = (str) => str.trim().toLowerCase();

const singularize = (word) => {
  const norm = normalize(word);
  return norm.endsWith('s') ? norm.slice(0, -1) : norm;
};

// Words that should NOT match even if one includes the other
const FALSE_POSITIVES = [
  { short: 'pepper', long: 'bell pepper' },
  { short: 'pepper', long: 'jalapeno pepper' },
  { short: 'pepper', long: 'chili pepper' },
  { short: 'tomato', long: 'tomato sauce' },
  { short: 'tomato', long: 'tomato paste' },
  { short: 'corn', long: 'popcorn' },
  { short: 'milk', long: 'coconut milk' },
  { short: 'milk', long: 'almond milk' },
  { short: 'oil', long: 'boil' },
];

// Common Substitutions Map (Target Recipe Item -> Possible Pantry Items)
const COMMON_SUBSTITUTIONS = {
  'coleslaw mix': ['cabbage', 'shredded cabbage', 'red cabbage', 'green cabbage'],
  'sour cream': ['greek yogurt', 'plain yogurt', 'yogurt'],
  'butter': ['margarine', 'oil', 'coconut oil', 'ghee'],
  'milk': ['almond milk', 'soy milk', 'oat milk', 'heavy cream', 'half and half', 'water'],
  'ground beef': ['ground turkey', 'ground chicken', 'lentils', 'tofu'],
  'ground turkey': ['ground beef', 'ground chicken', 'lentils'],
  'bread crumbs': ['oats', 'crushed crackers', 'croutons'],
  'egg': ['flax egg', 'chia egg', 'banana', 'applesauce'],
  'sugar': ['honey', 'maple syrup', 'stevia'],
  'soy sauce': ['tamari', 'coconut aminos'],
  'heavy cream': ['milk', 'half and half'],
};

const findPantryMatch = (recipeIng, pantryItems) => {
  const target = singularize(recipeIng);
  
  // 1. Check for Direct or Fuzzy Matches first
  const directMatch = pantryItems.find(item => {
    const source = singularize(item);
    
    // Exact Match
    if (source === target) return true;

    // Check Exceptions
    const isBadMatch = FALSE_POSITIVES.some(fp => {
       const sIsShort = source === fp.short;
       const tIsShort = target === fp.short;
       const sIsLong = source === fp.long;
       const tIsLong = target === fp.long;
       return (sIsShort && tIsLong) || (tIsShort && sIsLong);
    });
    if (isBadMatch) return false;

    // Partial Match Logic
    if (source.includes(target)) return true;
    if (target.includes(source)) return true;
    
    return false;
  });

  if (directMatch) return { name: directMatch, type: 'direct' };

  // 2. Check Substitutions
  const subOptions = COMMON_SUBSTITUTIONS[target];
  if (subOptions) {
    const subMatch = pantryItems.find(item => {
      const s = singularize(item);
      // Check if pantry item matches any of the valid substitutions
      return subOptions.some(opt => {
        const o = singularize(opt);
        return s === o || s.includes(o) || o.includes(s);
      });
    });
    
    if (subMatch) return { name: subMatch, type: 'sub' };
  }

  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('cook');
  const [pantryItems, setPantryItems] = useState(INITIAL_PANTRY);
  const [recipes, setRecipes] = useState(INITIAL_RECIPES);
  
  // View States
  const [viewingRecipe, setViewingRecipe] = useState(null); // Full Screen Recipe View
  const [mealPlan, setMealPlan] = useState({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  });
  const [planningRecipe, setPlanningRecipe] = useState(null);

  // Forms & Inputs
  const [newItem, setNewItem] = useState('');
  
  // Recipe Form State
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState(null); // ID of recipe being edited
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeIng, setNewRecipeIng] = useState('');
  const [newRecipeInst, setNewRecipeInst] = useState('');
  const [newRecipeType, setNewRecipeType] = useState('Dinner');

  // AI & Modals
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [loadingTips, setLoadingTips] = useState({}); 
  const [chefTips, setChefTips] = useState({});

  // --- Handlers: Standard ---
  const addPantryItem = (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    const item = normalize(newItem);
    if (!pantryItems.includes(item)) {
      setPantryItems([...pantryItems, item]);
    }
    setNewItem('');
  };

  const removePantryItem = (itemToRemove) => {
    setPantryItems(pantryItems.filter(item => item !== itemToRemove));
  };

  const handleRecipeSubmit = (e) => {
    e.preventDefault();
    if (!newRecipeName.trim() || !newRecipeIng.trim()) return;

    const ingredientsList = newRecipeIng.split(',').map(i => normalize(i)).filter(i => i.length > 0);

    if (editingRecipeId) {
      // Update existing recipe
      setRecipes(recipes.map(r => 
        r.id === editingRecipeId 
          ? { 
              ...r, 
              name: newRecipeName, 
              ingredients: ingredientsList, 
              instructions: newRecipeInst, 
              type: newRecipeType 
            } 
          : r
      ));
    } else {
      // Add new recipe
      const newRecipe = {
        id: Date.now(),
        name: newRecipeName,
        ingredients: ingredientsList,
        instructions: newRecipeInst,
        type: newRecipeType,
        notes: ''
      };
      setRecipes([...recipes, newRecipe]);
    }

    // Reset Form
    resetRecipeForm();
  };

  const startEditingRecipe = (recipe) => {
    setEditingRecipeId(recipe.id);
    setNewRecipeName(recipe.name);
    setNewRecipeIng(recipe.ingredients.join(', '));
    setNewRecipeInst(recipe.instructions);
    setNewRecipeType(recipe.type);
    setIsAddingRecipe(true);
    
    // Scroll to top of recipe list/form if needed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetRecipeForm = () => {
    setNewRecipeName('');
    setNewRecipeIng('');
    setNewRecipeInst('');
    setNewRecipeType('Dinner');
    setEditingRecipeId(null);
    setIsAddingRecipe(false);
  };

  const deleteRecipe = (id) => {
    if (confirm('Are you sure you want to delete this recipe?')) {
      setRecipes(recipes.filter(r => r.id !== id));
      const newPlan = { ...mealPlan };
      DAYS_OF_WEEK.forEach(day => {
        newPlan[day] = newPlan[day].filter(r => r.id !== id);
      });
      setMealPlan(newPlan);
    }
  };

  // --- Handlers: Notes ---
  const updateRecipeNotes = (id, newNotes) => {
    setRecipes(recipes.map(r => r.id === id ? { ...r, notes: newNotes } : r));
  };

  // --- Handlers: Meal Planning ---
  const addToMealPlan = (day) => {
    if (!planningRecipe) return;
    setMealPlan(prev => ({
      ...prev,
      [day]: [...prev[day], planningRecipe]
    }));
    setPlanningRecipe(null);
  };

  const removeFromMealPlan = (day, recipeId) => {
    setMealPlan(prev => ({
      ...prev,
      [day]: prev[day].filter(r => r.id !== recipeId)
    }));
  };

  // --- Handlers: AI Features ---
  
  // 1. Magic Recipe (Generate from scratch)
  const handleGenerateRecipe = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingRecipe(true);
    const systemPrompt = `You are a creative chef API. Return ONLY a JSON object: { "name": "string", "ingredients": ["string"], "instructions": "string", "type": "Dinner" }`;
    const userPrompt = `Request: "${aiPrompt}". Pantry: ${pantryItems.join(', ')}.`;

    try {
      const result = await callGemini(userPrompt, systemPrompt);
      const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const generatedRecipe = JSON.parse(cleanResult);
      const newRecipe = { id: Date.now(), notes: '', ...generatedRecipe };
      setRecipes([newRecipe, ...recipes]);
      setShowAiModal(false);
      setAiPrompt('');
    } catch (e) {
      alert("Failed to generate recipe. Please try again.");
    } finally {
      setIsGeneratingRecipe(false);
    }
  };

  // 2. Import & Normalize (Fixing the matching logic issue)
  const handleImportRecipe = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    
    const systemPrompt = `
      You are a Data Normalization Expert for a recipe app.
      Your goal is to parse messy text and extract a structured recipe.
      CRITICAL: You must normalize ingredient names to be simple, singular nouns that are likely to match a pantry inventory.
      Example: "2 cups of freshly chopped onions" -> "onion"
      Example: "1lb ground beef (80/20)" -> "ground beef"
      Example: "Salt and pepper to taste" -> "salt", "pepper"
      
      Return ONLY a JSON object with this structure:
      {
        "name": "string",
        "ingredients": ["string", "string"],
        "instructions": "string (formatted with newlines for steps)",
        "type": "Dinner"
      }
    `;

    try {
      const result = await callGemini(importText, systemPrompt);
      const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedRecipe = JSON.parse(cleanResult);
      
      // Pre-fill the add form with the clean data
      setNewRecipeName(parsedRecipe.name);
      setNewRecipeIng(parsedRecipe.ingredients.join(', '));
      setNewRecipeInst(parsedRecipe.instructions);
      setNewRecipeType(parsedRecipe.type || 'Dinner');
      
      // Close modal and open add form
      setShowImportModal(false);
      setIsAddingRecipe(true);
      setImportText('');
    } catch (e) {
      alert("Could not parse that text. Try pasting just the ingredients and instructions.");
      console.error(e);
    } finally {
      setIsImporting(false);
    }
  };

  // 3. Chef Tips
  const getChefTips = async (recipe, missingIngredients) => {
    setLoadingTips(prev => ({ ...prev, [recipe.id]: true }));
    const prompt = `Dish: "${recipe.name}". Missing: ${missingIngredients.join(', ')}. Pantry: ${pantryItems.join(', ')}. Give subs or tips. Short.`;
    const tip = await callGemini(prompt, "You are a helpful sous-chef.");
    setChefTips(prev => ({ ...prev, [recipe.id]: tip }));
    setLoadingTips(prev => ({ ...prev, [recipe.id]: false }));
  };


  // --- Logic ---
  const matchedRecipes = useMemo(() => {
    return recipes.map(recipe => {
      const ingredientDetails = recipe.ingredients.map(ing => {
        const matchInfo = findPantryMatch(ing, pantryItems);
        return {
          originalName: ing,
          matchedWith: matchInfo?.name,
          matchType: matchInfo?.type, // 'direct' or 'sub'
          isHave: !!matchInfo
        };
      });

      const missingCount = ingredientDetails.filter(i => !i.isHave).length;
      const totalCount = recipe.ingredients.length;
      const matchPercentage = Math.round(((totalCount - missingCount) / totalCount) * 100);
      const missingIngredients = ingredientDetails.filter(d => !d.isHave).map(d => d.originalName);

      return {
        ...recipe,
        ingredientDetails,
        matchPercentage,
        missingIngredients,
        isCookable: missingCount === 0
      };
    }).sort((a, b) => {
      if (a.isCookable && !b.isCookable) return -1;
      if (!a.isCookable && b.isCookable) return 1;
      return b.matchPercentage - a.matchPercentage;
    });
  }, [recipes, pantryItems]);

  const weeklyShoppingList = useMemo(() => {
    const needed = new Set();
    Object.values(mealPlan).flat().forEach(recipe => {
       recipe.ingredients.forEach(ing => {
         if (!findPantryMatch(ing, pantryItems)) {
           needed.add(ing);
         }
       });
    });
    return Array.from(needed).sort();
  }, [mealPlan, pantryItems]);


  // --- Full Screen Recipe View ---
  if (viewingRecipe) {
    const recipe = matchedRecipes.find(r => r.id === viewingRecipe.id) || viewingRecipe;
    
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button 
            onClick={() => setViewingRecipe(null)}
            className="mb-6 flex items-center text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" /> Back to App
          </button>
          
          <div className="space-y-8">
            <div className="border-b border-gray-100 pb-6">
              <span className="text-orange-600 font-bold tracking-wider text-sm uppercase">{recipe.type}</span>
              <h1 className="text-4xl font-extrabold text-gray-900 mt-2 mb-4">{recipe.name}</h1>
              
              <div className="flex flex-wrap gap-3">
                 {recipe.isCookable ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4"/> Ready to Cook
                    </span>
                 ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-bold">
                       {recipe.matchPercentage}% Match
                    </span>
                 )}
                 {recipe.ingredientDetails.some(i => i.matchType === 'sub') && (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold">
                     <ArrowRightLeft className="w-4 h-4"/> Subs Available
                   </span>
                 )}
                 <button
                   onClick={() => { setViewingRecipe(null); startEditingRecipe(recipe); }}
                   className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm font-bold transition-colors"
                 >
                   <Pencil className="w-3 h-3"/> Edit Recipe
                 </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Left Column: Ingredients & Notes */}
              <div className="md:col-span-1 space-y-6">
                
                {/* Ingredients List */}
                <div className="bg-orange-50/50 p-6 rounded-2xl">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ShoppingBasket className="w-5 h-5 text-orange-600"/> Ingredients
                  </h3>
                  <ul className="space-y-3">
                    {recipe.ingredientDetails ? (
                      recipe.ingredientDetails.map((ing, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          {ing.isHave ? (
                            ing.matchType === 'sub' ? (
                                <div className="mt-0.5 bg-yellow-100 p-1 rounded-full text-yellow-600 shrink-0">
                                  <ArrowRightLeft className="w-3 h-3" />
                                </div>
                            ) : (
                                <div className="mt-0.5 bg-green-100 p-1 rounded-full text-green-600 shrink-0">
                                  <CheckCircle2 className="w-3 h-3" />
                                </div>
                            )
                          ) : (
                            <div className="mt-0.5 bg-red-100 p-1 rounded-full text-red-600 shrink-0">
                               <AlertCircle className="w-3 h-3" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium ${ing.isHave ? (ing.matchType === 'sub' ? 'text-yellow-800' : 'text-gray-800') : 'text-red-700'}`}>
                              {ing.originalName}
                            </span>
                            {/* Visible Substitution Text */}
                            {ing.matchType === 'sub' && (
                               <span className="text-xs text-yellow-600 font-medium">Use {ing.matchedWith} instead</span>
                            )}
                            {ing.matchType === 'direct' && ing.matchedWith !== ing.originalName && (
                              <span className="text-xs text-gray-400">using {ing.matchedWith}</span>
                            )}
                          </div>
                        </li>
                      ))
                    ) : (
                      recipe.ingredients.map((ing, idx) => <li key={idx} className="text-sm text-gray-700">{ing}</li>)
                    )}
                  </ul>
                </div>

                {/* Personal Notes Section */}
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-blue-600"/> My Kitchen Notes
                  </h3>
                  <textarea
                    className="w-full bg-white rounded-lg border-blue-200 text-sm p-3 text-gray-700 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                    rows="4"
                    placeholder="Add your personal tweaks here..."
                    value={recipe.notes || ''}
                    onChange={(e) => updateRecipeNotes(recipe.id, e.target.value)}
                  />
                  <div className="mt-2 text-xs text-blue-400 flex items-center gap-1 justify-end">
                    <Save className="w-3 h-3" /> Auto-saving
                  </div>
                </div>

              </div>

              {/* Instructions Column */}
              <div className="md:col-span-2">
                 <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                   <Utensils className="w-5 h-5 text-orange-600"/> Instructions
                 </h3>
                 <div className="prose prose-orange text-gray-700">
                    {recipe.instructions ? (
                      recipe.instructions.split('\n').map((step, idx) => (
                        <p key={idx} className="mb-4 text-lg leading-relaxed bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                          {step}
                        </p>
                      ))
                    ) : (
                      <p className="italic text-gray-400">No instructions available.</p>
                    )}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App View ---
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans selection:bg-orange-100 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600">
            <ChefHat className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900">PantryPal</h1>
          </div>
          
          <nav className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'pantry', label: 'Pantry', icon: ShoppingBasket },
              { id: 'recipes', label: 'Recipes', icon: Utensils },
              { id: 'cook', label: 'Cook Now', icon: ChefHat },
              { id: 'plan', label: 'Meal Plan', icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap
                  ${activeTab === tab.id 
                    ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                `}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* VIEW: PANTRY */}
        {activeTab === 'pantry' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Kitchen Inventory</h2>
              <p className="text-gray-500">Add everything you have. We'll handle the matching logic.</p>
            </div>

            <div className="max-w-xl mx-auto">
              <form onSubmit={addPantryItem} className="relative group">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="e.g. spinach, cheddar, rice..."
                  className="w-full pl-5 pr-14 py-4 rounded-xl border-2 border-gray-100 bg-white shadow-sm focus:border-orange-500 focus:ring-0 text-lg transition-colors"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 aspect-square bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <ShoppingBasket className="w-5 h-5" />
                  In Stock <span className="text-gray-400 font-normal">({pantryItems.length})</span>
                </h3>
                {pantryItems.length > 0 && (
                   <button 
                   onClick={() => setPantryItems([])}
                   className="text-xs text-red-500 hover:text-red-700 hover:underline"
                 >
                   Clear All
                 </button>
                )}
              </div>
              
              {pantryItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  Your pantry is empty. Add some ingredients above!
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pantryItems.map(item => (
                    <span 
                      key={item} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-800 rounded-full text-sm border border-orange-100 group hover:bg-orange-100 transition-colors cursor-default"
                    >
                      {item}
                      <button 
                        onClick={() => removePantryItem(item)}
                        className="text-orange-400 hover:text-red-600 focus:outline-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: RECIPES */}
        {activeTab === 'recipes' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Recipe Book</h2>
                <p className="text-gray-500">Manage your favorite meals here.</p>
              </div>
              <div className="flex gap-2">
                <button
                   onClick={() => setShowImportModal(true)}
                   className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors shadow-lg shadow-gray-200"
                >
                  <ClipboardPaste className="w-4 h-4 text-gray-300" />
                  Import
                </button>
                <button
                  onClick={() => { setShowAiModal(true); setAiPrompt('Suggest a recipe using my pantry ingredients'); }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md shadow-purple-200"
                >
                  <Sparkles className="w-4 h-4 text-yellow-200" />
                  Magic Recipe
                </button>
                <button
                  onClick={() => { resetRecipeForm(); setIsAddingRecipe(!isAddingRecipe); }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {isAddingRecipe ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
                  {isAddingRecipe ? 'Cancel' : 'Add'}
                </button>
              </div>
            </div>

            {/* AI Generator Modal */}
            {showAiModal && (
               <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                 <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-purple-100 animate-in zoom-in-95">
                   <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-purple-600" />
                       AI Chef Generator
                     </h3>
                     <button onClick={() => setShowAiModal(false)} className="text-gray-400 hover:text-gray-600">
                       <X className="w-5 h-5" />
                     </button>
                   </div>
                   <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe your craving..."
                    className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none mb-4 resize-none h-32"
                   />
                   <button 
                    onClick={handleGenerateRecipe}
                    disabled={isGeneratingRecipe}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                   >
                     {isGeneratingRecipe ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-yellow-300" />}
                     {isGeneratingRecipe ? 'Inventing...' : 'Generate Recipe'}
                   </button>
                 </div>
               </div>
            )}

            {/* Import / Paste Modal */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <ClipboardPaste className="w-5 h-5 text-blue-600" />
                      Import Recipe Text
                    </h3>
                    <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    Paste text from a website or blog. We will clean it up and normalize ingredients for better matching.
                  </p>
                  <textarea
                   value={importText}
                   onChange={(e) => setImportText(e.target.value)}
                   placeholder="Paste recipe here (Ingredients, Instructions, etc)..."
                   className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4 resize-none h-48 text-sm font-mono"
                  />
                  <button 
                   onClick={handleImportRecipe}
                   disabled={isImporting}
                   className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
                  >
                    {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    {isImporting ? 'Normalizing Data...' : 'Process & Import'}
                  </button>
                </div>
              </div>
            )}

            {/* Add / Edit Recipe Form */}
            {isAddingRecipe && (
              <form onSubmit={handleRecipeSubmit} className="bg-white p-6 rounded-2xl shadow-lg border border-orange-100 space-y-4 animate-in fade-in zoom-in-95">
                <h3 className="font-bold text-gray-900">{editingRecipeId ? 'Edit Recipe' : 'Add New Recipe'}</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
                  <input
                    required
                    type="text"
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    placeholder="Grandma's Meatloaf"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-0"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newRecipeType}
                      onChange={(e) => setNewRecipeType(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-0 bg-white"
                    >
                      <option>Breakfast</option>
                      <option>Lunch</option>
                      <option>Dinner</option>
                      <option>Snack</option>
                      <option>Dessert</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients (comma separated)</label>
                    <input
                      required
                      type="text"
                      value={newRecipeIng}
                      onChange={(e) => setNewRecipeIng(e.target.value)}
                      placeholder="beef, onion, ketchup, oats"
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                  <textarea
                    value={newRecipeInst}
                    onChange={(e) => setNewRecipeInst(e.target.value)}
                    placeholder="1. Preheat oven..."
                    rows="5"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-0 resize-none"
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <button type="submit" className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">
                    {editingRecipeId ? 'Update Recipe' : 'Save Recipe'}
                  </button>
                </div>
              </form>
            )}

            {/* Recipe List */}
            <div className="grid gap-4 sm:grid-cols-2">
              {recipes.map(recipe => (
                <div key={recipe.id} className="group bg-white p-5 rounded-xl border border-gray-200 hover:border-orange-200 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold tracking-wider text-orange-600 uppercase mb-1 block">{recipe.type}</span>
                      <h3 className="font-bold text-lg text-gray-900">{recipe.name}</h3>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                        onClick={() => startEditingRecipe(recipe)}
                        title="Edit Recipe"
                        className="text-gray-400 hover:text-blue-500"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button 
                         onClick={() => setViewingRecipe(recipe)}
                         className="text-gray-400 hover:text-blue-600"
                         title="View Details"
                      >
                        <Maximize2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setPlanningRecipe(recipe)}
                        title="Add to Meal Plan"
                        className="text-gray-400 hover:text-orange-500"
                      >
                        <Calendar className="w-5 h-5" />
                      </button>
                      <button onClick={() => deleteRecipe(recipe.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{recipe.ingredients.join(', ')}</p>
                  <div className="mt-4">
                     <button 
                       onClick={() => setViewingRecipe(recipe)}
                       className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm font-medium transition-colors border border-gray-100"
                     >
                       Open Recipe
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL: Select Day for Meal Plan */}
        {planningRecipe && (
           <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900">Plan for {planningRecipe.name}</h3>
                 <button onClick={() => setPlanningRecipe(null)}><X className="w-5 h-5 text-gray-400" /></button>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 {DAYS_OF_WEEK.map(day => (
                   <button
                     key={day}
                     onClick={() => addToMealPlan(day)}
                     className="px-4 py-3 rounded-lg border border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-left font-medium transition-all"
                   >
                     {day}
                   </button>
                 ))}
               </div>
             </div>
           </div>
        )}

        {/* VIEW: MEAL PLAN */}
        {activeTab === 'plan' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Left: The Plan */}
              <div className="flex-1 space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">Weekly Meal Plan</h2>
                <div className="space-y-4">
                  {DAYS_OF_WEEK.map(day => (
                    <div key={day} className="bg-white rounded-xl p-4 border border-gray-200">
                      <h3 className="font-bold text-gray-700 mb-3">{day}</h3>
                      {mealPlan[day].length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No meals planned.</p>
                      ) : (
                        <div className="space-y-2">
                          {mealPlan[day].map((recipe, idx) => (
                            <div key={`${recipe.id}-${idx}`} className="flex items-center justify-between bg-orange-50 p-3 rounded-lg">
                              <span className="font-medium text-orange-900">{recipe.name}</span>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setViewingRecipe(recipe)}
                                  className="text-orange-300 hover:text-orange-600"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => removeFromMealPlan(day, recipe.id)}
                                  className="text-orange-300 hover:text-red-500"
                                >
                                  <MinusCircle className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Shopping List */}
              <div className="md:w-80 space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingBasket className="w-5 h-5 text-orange-500" />
                    <h2 className="text-lg font-bold text-gray-900">Shopping List</h2>
                  </div>
                  
                  {weeklyShoppingList.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      You have all ingredients for your planned meals! (Or no meals planned yet).
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {weeklyShoppingList.map(ing => (
                        <li key={ing} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          <span className="capitalize">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {weeklyShoppingList.length > 0 && (
                     <div className="mt-6 pt-4 border-t border-gray-100">
                       <p className="text-xs text-gray-400">Based on your meal plan and current pantry.</p>
                     </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: COOK NOW (MATCHING LOGIC) */}
        {activeTab === 'cook' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Matching Results</h2>
              <p className="text-gray-500">Based on your {pantryItems.length} pantry ingredients with smart matching.</p>
            </div>

            <div className="grid gap-6">
              {matchedRecipes.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 font-medium">No recipes found.</p>
                  <p className="text-gray-400">Try adding more ingredients to your pantry or adding new recipes.</p>
                </div>
              ) : (
                matchedRecipes.map((recipe) => (
                  <div 
                    key={recipe.id} 
                    className={`
                      relative overflow-hidden rounded-2xl border transition-all duration-300
                      ${recipe.isCookable 
                        ? 'bg-white border-green-200 shadow-md ring-1 ring-green-100' 
                        : 'bg-white border-gray-200 opacity-90 grayscale-[0.3] hover:grayscale-0 hover:border-orange-200'}
                    `}
                  >
                    {/* Status Banner for Cookable */}
                    {recipe.isCookable && (
                      <div className="bg-green-100 text-green-800 text-xs font-bold px-4 py-1 flex items-center gap-1.5 border-b border-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        READY TO COOK
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{recipe.type}</span>
                            {!recipe.isCookable && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${recipe.matchPercentage > 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                {recipe.matchPercentage}% Match
                              </span>
                            )}
                            {recipe.ingredientDetails.some(i => i.matchType === 'sub') && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3" /> Subs Used
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{recipe.name}</h3>
                          <div className="flex gap-2 mt-2">
                             <button 
                               onClick={() => setViewingRecipe(recipe)}
                               className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-1.5 rounded-lg border border-orange-200 flex items-center gap-1 transition-colors font-medium"
                             >
                               <Utensils className="w-3 h-3" /> Cook / View
                             </button>
                             <button 
                               onClick={() => setPlanningRecipe(recipe)}
                               className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1 transition-colors"
                             >
                               <Calendar className="w-3 h-3" /> Plan
                             </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ingredients Breakdown</div>
                        <div className="flex flex-wrap gap-2">
                          {recipe.ingredientDetails.map((detail, idx) => {
                            const isExact = detail.matchedWith === detail.originalName;
                            
                            // Visuals for Substitution vs Direct Match
                            const isSub = detail.matchType === 'sub';

                            const displayText = isExact 
                              ? detail.originalName 
                              : detail.matchedWith 
                                ? <span>{detail.originalName} <span className="opacity-75 text-[10px] uppercase font-bold tracking-wide ml-0.5">({isSub ? 'SUB: ' : 'using '}{detail.matchedWith})</span></span>
                                : detail.originalName;

                            return (
                              <span 
                                key={idx}
                                className={`
                                  inline-flex items-center px-2.5 py-1 rounded-md text-sm border
                                  ${detail.isHave 
                                    ? (isSub 
                                        ? 'bg-yellow-50 text-yellow-800 border-yellow-200' // Yellow for Subs
                                        : 'bg-green-50 text-green-700 border-green-200') // Green for Direct
                                    : 'bg-red-50 text-red-700 border-red-200 font-medium'}
                                `}
                              >
                                {detail.isHave ? (isSub ? <ArrowRightLeft className="w-3 h-3 mr-1.5 opacity-50"/> : <Utensils className="w-3 h-3 mr-1.5 opacity-50"/>) : <AlertCircle className="w-3 h-3 mr-1.5"/>}
                                {displayText}
                              </span>
                            );
                          })}
                        </div>
                        
                        {!recipe.isCookable && (
                           <div className="mt-3 pt-3 border-t border-gray-200 flex items-start gap-2 text-sm text-red-600">
                             <ShoppingBasket className="w-4 h-4 shrink-0 mt-0.5" />
                             <span>Missing: <span className="font-semibold">{recipe.missingIngredients.join(', ')}</span></span>
                           </div>
                        )}
                      </div>

                      {/* Gemini Chef Tips Section */}
                      <div className="mt-4">
                        {!chefTips[recipe.id] ? (
                          <button
                            onClick={() => getChefTips(recipe, recipe.missingIngredients)}
                            disabled={loadingTips[recipe.id]}
                            className="text-sm font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {loadingTips[recipe.id] ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                            {loadingTips[recipe.id] ? 'Asking Chef...' : 'Ask Chef for Tips'}
                          </button>
                        ) : (
                          <div className="mt-3 bg-purple-50 rounded-xl p-4 border border-purple-100 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-start mb-2">
                               <h4 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                                 <Lightbulb className="w-4 h-4 text-purple-600" />
                                 Chef's Advice
                               </h4>
                               <button onClick={() => setChefTips(prev => ({...prev, [recipe.id]: null}))}>
                                 <X className="w-4 h-4 text-purple-400 hover:text-purple-600" />
                               </button>
                            </div>
                            <p className="text-sm text-purple-800 whitespace-pre-line">{chefTips[recipe.id]}</p>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}