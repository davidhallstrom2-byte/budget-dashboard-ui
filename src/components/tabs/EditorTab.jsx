import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Archive, Undo2, GripVertical, Trash2, FolderPlus, FolderMinus, Edit2, ArrowUp, ArrowDown, Copy, ChevronDown, ChevronUp, Search, Zap, AlertCircle, Clock, Download, ListPlus } from 'lucide-react';
import {
  DollarSign, Home, Car, Utensils, User, Monitor,
  CreditCard, Repeat, Package
} from 'lucide-react';
import PageContainer from "../common/PageContainer.jsx";

const categoryIcons = {
  income:         { icon: DollarSign,  color: 'text-green-600' },
  housing:        { icon: Home,        color: 'text-blue-600' },
  transportation: { icon: Car,         color: 'text-purple-600' },
  food:           { icon: Utensils,    color: 'text-orange-600' },
  personal:       { icon: User,        color: 'text-pink-600' },
  homeOffice:     { icon: Monitor,     color: 'text-indigo-600' },
  banking:        { icon: CreditCard,  color: 'text-emerald-600' },
  subscriptions:  { icon: Repeat,      color: 'text-teal-600' },
  misc:           { icon: Package,     color: 'text-gray-600' },
};

const PROTECTED_BUCKETS = new Set([
  'income','housing','transportation','food','personal','homeOffice','banking','subscriptions','misc'
]);

const DEFAULT_ORDER = [
  'income','housing','transportation','food','personal','homeOffice','banking','subscriptions','misc'
];

const DEFAULT_TITLES = {
  income: 'Income',
  housing: 'Housing',
  transportation: 'Transportation',
  food: 'Food & Dining',
  personal: 'Personal',
  homeOffice: 'Home & Office',
  banking: 'Banking & Finance',
  subscriptions: 'Subscriptions',
  misc: 'Miscellaneous'
};

const ITEM_TEMPLATES = [
  { name: 'Rent/Mortgage', category: 'housing', estBudget: 1500, recurrence: 'monthly' },
  { name: 'Electric Bill', category: 'housing', estBudget: 150, recurrence: 'monthly' },
  { name: 'Water Bill', category: 'housing', estBudget: 50, recurrence: 'monthly' },
  { name: 'Internet', category: 'housing', estBudget: 80, recurrence: 'monthly' },
  { name: 'Car Payment', category: 'transportation', estBudget: 400, recurrence: 'monthly' },
  { name: 'Car Insurance', category: 'transportation', estBudget: 150, recurrence: 'monthly' },
  { name: 'Gas', category: 'transportation', estBudget: 200, recurrence: 'monthly' },
  { name: 'Groceries', category: 'food', estBudget: 600, recurrence: 'monthly' },
  { name: 'Phone Bill', category: 'personal', estBudget: 70, recurrence: 'monthly' },
  { name: 'Netflix', category: 'subscriptions', estBudget: 15.49, recurrence: 'monthly' },
  { name: 'Spotify', category: 'subscriptions', estBudget: 10.99, recurrence: 'monthly' },
];

const EditorTab = ({ state, setState, saveBudget }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedFromBucket, setDraggedFromBucket] = useState(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null);
  const [undoTimerId, setUndoTimerId] = useState(null);
  const [categoryNames, setCategoryNames] = useState({});
  const [recentlyCleared, setRecentlyCleared] = useState(false);
  const [clearTimerId, setClearTimerId] = useState(null);
  
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Tier 3 features
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [batchAddMode, setBatchAddMode] = useState(false);
  const [batchAddCategory, setBatchAddCategory] = useState('');
  const batchItemNameRef = useRef(null);

  useEffect(() => {
    if (state?.meta?.categoryNames) {
      setCategoryNames(state.meta.categoryNames);
    }
    if (state?.meta?.categoryOrder) {
      setCategoryOrder(state.meta.categoryOrder);
    } else {
      // Initialize with default order plus custom categories
      const customBuckets = Object.keys(state?.buckets || {}).filter(k => !DEFAULT_ORDER.includes(k));
      setCategoryOrder([...DEFAULT_ORDER, ...customBuckets]);
    }
  }, [state?.meta?.categoryNames, state?.meta?.categoryOrder, state?.buckets]);

  useEffect(() => {
    if (!state?.buckets) return;
    const personal = state.buckets.personal || [];
    if (personal.length === 0) return;

    const toMoveNames = new Set([
      'AMC Premier','Disney+/ESPN/HULU','Paramount+','Netflix','Amazon Prime','CVS ExtraCare'
    ]);

    let moved = false;
    const keep = [];
    const move = [];
    for (const item of personal) {
      if (item?.category && toMoveNames.has(item.category.trim())) {
        move.push(item);
        moved = true;
      } else {
        keep.push(item);
      }
    }
    if (moved) {
      const updatedBuckets = {
        ...state.buckets,
        personal: keep,
        subscriptions: [...(state.buckets.subscriptions || []), ...move]
      };
      const updatedState = { ...state, buckets: updatedBuckets };
      setState(updatedState);
      setTimeout(() => saveBudgetWithIndicator(updatedState, false), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus on batch add input when mode is enabled
  useEffect(() => {
    if (batchAddMode && batchItemNameRef.current) {
      batchItemNameRef.current.focus();
    }
  }, [batchAddMode, batchAddCategory]);

  const saveBudgetWithIndicator = async (customState = null, customMessage = null) => {
    setIsSaving(true);
    await saveBudget(customState, customMessage);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const getRowBackgroundColor = (item) => {
    if (item.status === 'paid') return 'bg-green-100 border-green-200';
    const today = new Date();
    const diffDays = Math.ceil((new Date(item.dueDate) - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'bg-red-100 border-red-200';
    if (diffDays <= 5) return 'bg-yellow-100 border-yellow-200';
    return 'bg-white border-gray-200';
  };

  const getItemStatus = (item) => {
    if (item.status === 'paid') return 'paid';
    const today = new Date();
    const diffDays = Math.ceil((new Date(item.dueDate) - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    return 'pending';
  };

  const handlePaidClick = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item) return;

    const currentDate = new Date(item.dueDate + 'T00:00:00');
    let newDate;
    
    if (bucket === 'subscriptions') {
      newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() + 1);
    } else {
      newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
    }

    const previousState = { dueDate: item.dueDate, status: item.status, actualCost: item.actualCost };

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? { ...it, status: 'paid', dueDate: newDate.toISOString().split('T')[0], previousState } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item marked as paid!'), 100);
  };

  const handleUndoPaid = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item || !item.previousState) return;

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? { ...it, ...it.previousState, previousState: undefined } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Payment undone!'), 100);
  };

  const handleArchiveClick = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item) return;

    const archivedItem = { ...item, originalBucket: bucket, archivedAt: new Date().toISOString() };
    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].filter(it => it.id !== id)
    };
    const updatedState = { ...state, buckets: updatedBuckets, archived: [...(state.archived || []), archivedItem] };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item archived successfully!'), 100);
  };

  const handleDeleteClick = (bucket, id) => {
    const item = state.buckets[bucket].find(x => x.id === id);
    if (!item) return;

    const updatedBuckets = { ...state.buckets, [bucket]: state.buckets[bucket].filter(x => x.id !== id) };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    
    if (undoTimerId) clearTimeout(undoTimerId);
    setRecentlyDeleted({ bucket, item });
    const tid = setTimeout(() => setRecentlyDeleted(null), 10000);
    setUndoTimerId(tid);
    
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item deleted successfully!'), 100);
  };

  const handleClearStatus = (bucket, id) => {
    const item = state.buckets[bucket].find(x => x.id === id);
    if (!item) return;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? { ...it, status: 'pending', dueDate: futureDate.toISOString().split('T')[0], previousState: undefined } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);

    if (clearTimerId) clearTimeout(clearTimerId);
    setRecentlyCleared(true);
    const tid = setTimeout(() => setRecentlyCleared(false), 3000);
    setClearTimerId(tid);
    
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Row bgcolor reset'), 100);
  };

  const undoDelete = () => {
    if (!recentlyDeleted) return;
    const { bucket, item } = recentlyDeleted;
    const updatedBuckets = { ...state.buckets, [bucket]: [...(state.buckets[bucket] || []), item] };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Delete undone successfully!'), 100);
    if (undoTimerId) clearTimeout(undoTimerId);
    setUndoTimerId(null);
    setRecentlyDeleted(null);
  };

  const handleMoveUp = (bucket, index) => {
    if (index === 0) return;
    
    const items = [...state.buckets[bucket]];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    
    const updatedBuckets = { ...state.buckets, [bucket]: items };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, false), 100);
  };

  const handleMoveDown = (bucket, index) => {
    const items = state.buckets[bucket];
    if (index === items.length - 1) return;
    
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    
    const updatedBuckets = { ...state.buckets, [bucket]: newItems };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, false), 100);
  };

  const handleDragStart = (e, bucket, item) => {
    setDraggedItem(item);
    setDraggedFromBucket(bucket);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => { 
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move'; 
  };

  const handleDrop = (e, targetBucket) => {
    e.preventDefault();
    
    if (!draggedItem || !draggedFromBucket) return;
    if (draggedFromBucket === targetBucket) {
      setDraggedItem(null);
      setDraggedFromBucket(null);
      return;
    }

    const updatedSourceBucket = state.buckets[draggedFromBucket].filter(it => it.id !== draggedItem.id);
    
    let updatedTargetBucket = [...state.buckets[targetBucket]];
    updatedTargetBucket.push(draggedItem);

    const updatedBuckets = {
      ...state.buckets,
      [draggedFromBucket]: updatedSourceBucket,
      [targetBucket]: updatedTargetBucket
    };
    
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, `Item moved to ${targetBucket}`), 100);
    setDraggedItem(null);
    setDraggedFromBucket(null);
  };

  // Tier 3: Category drag and drop
  const handleCategoryDragStart = (e, categoryKey) => {
    setDraggedCategory(categoryKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCategoryDrop = (e, targetCategoryKey) => {
    e.preventDefault();
    
    if (!draggedCategory || draggedCategory === targetCategoryKey) {
      setDraggedCategory(null);
      return;
    }

    const newOrder = [...categoryOrder];
    const draggedIndex = newOrder.indexOf(draggedCategory);
    const targetIndex = newOrder.indexOf(targetCategoryKey);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedCategory);

    setCategoryOrder(newOrder);
    
    const updatedState = {
      ...state,
      meta: {
        ...state.meta,
        categoryOrder: newOrder
      }
    };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Categories reordered!'), 100);
    setDraggedCategory(null);
  };

  // Tier 3: Export category to CSV
  const exportCategoryToCSV = (bucketName, items) => {
    const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
    
    const headers = ['Item', 'Est. Budget', 'Actual Cost', 'Due Date', 'Status'];
    const rows = items.map(item => [
      item.category || '',
      item.estBudget || 0,
      item.actualCost || 0,
      item.dueDate || '',
      item.status || 'pending'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${displayTitle}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renameCategory = (bucketName) => {
    const currentName = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
    const newName = prompt(`Rename category "${currentName}" to:`, currentName)?.trim();
    
    if (!newName || newName === currentName) return;

    const updatedNames = { ...categoryNames, [bucketName]: newName };
    setCategoryNames(updatedNames);

    const updatedState = {
      ...state,
      meta: {
        ...state.meta,
        categoryNames: updatedNames
      }
    };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Category renamed successfully!'), 100);
  };

  const addCategory = () => {
    const key = prompt('New category key (letters only, no spaces):')?.trim();
    if (!key) return;
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) { alert('Invalid key format.'); return; }
    if (state.buckets[key]) { alert('Category already exists.'); return; }

    const newOrder = [...categoryOrder, key];
    const updatedState = { 
      ...state, 
      buckets: { ...state.buckets, [key]: [] },
      meta: {
        ...state.meta,
        categoryOrder: newOrder
      }
    };
    setState(updatedState);
    setCategoryOrder(newOrder);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Category added successfully!'), 100);
  };

  const deleteCategory = () => {
    const deletableCategories = Object.keys(state.buckets || {})
      .filter(key => !PROTECTED_BUCKETS.has(key))
      .filter(key => (state.buckets[key] || []).length === 0);

    if (deletableCategories.length === 0) {
      alert('No categories available to delete. Categories must be empty and not protected.');
      return;
    }

    const options = deletableCategories.map(key => `<option value="${key}">${key}</option>`).join('');
    
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
          <h3 style="margin: 0 0 15px 0;">Delete Category</h3>
          <label style="display: block; margin-bottom: 10px;">Category to delete (must be empty and not protected):</label>
          <select id="categorySelect" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px;">
            ${options}
          </select>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="okBtn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const closeDialog = () => document.body.removeChild(dialog);
    
    dialog.querySelector('#cancelBtn').onclick = closeDialog;
    dialog.querySelector('#okBtn').onclick = () => {
      const selectedKey = dialog.querySelector('#categorySelect').value;
      if (selectedKey) {
        const { [selectedKey]: _, ...rest } = state.buckets;
        const newOrder = categoryOrder.filter(k => k !== selectedKey);
        const updatedState = { 
          ...state, 
          buckets: rest,
          meta: {
            ...state.meta,
            categoryOrder: newOrder
          }
        };
        setState(updatedState);
        setCategoryOrder(newOrder);
        setTimeout(() => saveBudgetWithIndicator(updatedState, 'Category deleted successfully!'), 100);
      }
      closeDialog();
    };
  };

  const addRow = (bucket) => {
    const newRow = {
      id: `${bucket}-${Date.now()}`,
      category: '',
      estBudget: 0,
      actualCost: 0,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    const updatedBuckets = { ...state.buckets, [bucket]: [...state.buckets[bucket], newRow] };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
  };

  // Tier 3: Batch add mode
  const addBatchItem = (e) => {
    e.preventDefault();
    if (!batchAddCategory || !batchItemNameRef.current) return;

    const itemName = batchItemNameRef.current.value.trim();
    if (!itemName) return;

    const newRow = {
      id: `${batchAddCategory}-${Date.now()}`,
      category: itemName,
      estBudget: 0,
      actualCost: 0,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    const updatedBuckets = { 
      ...state.buckets, 
      [batchAddCategory]: [...(state.buckets[batchAddCategory] || []), newRow] 
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);

    // Clear input and refocus
    batchItemNameRef.current.value = '';
    batchItemNameRef.current.focus();
  };

  const updateRow = (bucket, id, field, value) => {
    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(item => item.id === id ? { ...item, [field]: value } : item)
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
  };

  // Tier 3: Auto-fill actual from budget
  const handleActualCostBlur = (bucket, id, value) => {
    const item = state.buckets[bucket].find(x => x.id === id);
    if (!item) return;

    // If actual cost is 0 or empty, auto-fill from estimated budget
    const actualValue = parseFloat(value) || 0;
    const finalValue = actualValue === 0 && item.estBudget > 0 ? item.estBudget : actualValue;

    updateRow(bucket, id, 'actualCost', finalValue);
  };

  const duplicateItem = (bucket, id) => {
    const item = state.buckets[bucket].find(x => x.id === id);
    if (!item) return;

    const newItem = {
      ...item,
      id: `${bucket}-${Date.now()}`,
      status: 'pending',
      actualCost: 0
    };

    const updatedBuckets = { ...state.buckets, [bucket]: [...state.buckets[bucket], newItem] };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item duplicated!'), 100);
  };

  const collapseAll = () => {
    const allCategories = {};
    categoryOrder.forEach(key => {
      allCategories[key] = true;
    });
    setCollapsedCategories(allCategories);
  };

  const expandAll = () => {
    setCollapsedCategories({});
  };

  const toggleCategory = (key) => {
    setCollapsedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelectItem = (bucket, id) => {
    const key = `${bucket}:${id}`;
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const bulkDelete = () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} selected items?`)) return;

    const updatedBuckets = { ...state.buckets };
    selectedItems.forEach(key => {
      const [bucket, id] = key.split(':');
      updatedBuckets[bucket] = updatedBuckets[bucket].filter(x => x.id !== id);
    });

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setSelectedItems(new Set());
    setTimeout(() => saveBudgetWithIndicator(updatedState, `${selectedItems.size} items deleted!`), 100);
  };

  const bulkArchive = () => {
    if (selectedItems.size === 0) return;

    const updatedBuckets = { ...state.buckets };
    const newArchived = [...(state.archived || [])];

    selectedItems.forEach(key => {
      const [bucket, id] = key.split(':');
      const item = updatedBuckets[bucket].find(x => x.id === id);
      if (item) {
        newArchived.push({ ...item, originalBucket: bucket, archivedAt: new Date().toISOString() });
        updatedBuckets[bucket] = updatedBuckets[bucket].filter(x => x.id !== id);
      }
    });

    const updatedState = { ...state, buckets: updatedBuckets, archived: newArchived };
    setState(updatedState);
    setSelectedItems(new Set());
    setTimeout(() => saveBudgetWithIndicator(updatedState, `${selectedItems.size} items archived!`), 100);
  };

  const addFromTemplate = (template) => {
    const newItem = {
      id: `${template.category}-${Date.now()}`,
      category: template.name,
      estBudget: template.estBudget,
      actualCost: 0,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    const updatedBuckets = {
      ...state.buckets,
      [template.category]: [...(state.buckets[template.category] || []), newItem]
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setShowTemplates(false);
    setTimeout(() => saveBudgetWithIndicator(updatedState, `Added "${template.name}" from template!`), 100);
  };

  const getCategoryStatusCounts = (items) => {
    const counts = { overdue: 0, pending: 0, paid: 0 };
    items.forEach(item => {
      const status = getItemStatus(item);
      counts[status]++;
    });
    return counts;
  };

  const BucketSection = ({ bucketName, items, title }) => {
    const IconComponent = categoryIcons[bucketName]?.icon || Package;
    const iconColor = categoryIcons[bucketName]?.color || 'text-gray-600';
    const displayTitle = categoryNames[bucketName] || title;
    const isCollapsed = collapsedCategories[bucketName];

    let filteredItems = items.filter(item => {
      if (statusFilter === 'all') return true;
      return getItemStatus(item) === statusFilter;
    });

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.category?.toLowerCase().includes(query) ||
        item.estBudget?.toString().includes(query) ||
        item.actualCost?.toString().includes(query)
      );
    }

    const totalBudgeted = items.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
    const totalActual = items.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
    const variance = totalActual - totalBudgeted;
    const statusCounts = getCategoryStatusCounts(items);

    return (
      <div 
        className="mb-8"
        draggable
        onDragStart={(e) => handleCategoryDragStart(e, bucketName)}
        onDragOver={handleCategoryDragOver}
        onDrop={(e) => handleCategoryDrop(e, bucketName)}
      >
        <div className="bg-black text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-move">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => toggleCategory(bucketName)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <IconComponent className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
            <h3 className="text-lg font-semibold">{displayTitle}</h3>
            <span className="text-sm opacity-75">({filteredItems.length} items)</span>
            
            <div className="flex gap-1 ml-2">
              {statusCounts.overdue > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {statusCounts.overdue}
                </span>
              )}
              {statusCounts.pending > 0 && (
                <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {statusCounts.pending}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCategoryToCSV(bucketName, items)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => renameCategory(bucketName)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
              title="Rename Category"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div
            className="border border-gray-300 rounded-b-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, bucketName)}
          >
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 w-28">Est. Budget</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 w-28">Actual Cost</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 w-36">Due Date</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const itemKey = `${bucketName}:${item.id}`;
                  const isSelected = selectedItems.has(itemKey);
                  
                  return (
                    <tr
                      key={item.id}
                      className={`border-t ${getRowBackgroundColor(item)} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, bucketName, item)}
                    >
                      <td className="px-1 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(bucketName, item.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-1 py-2 w-8">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveUp(bucketName, items.indexOf(item))}
                            disabled={items.indexOf(item) === 0}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(bucketName, items.indexOf(item))}
                            disabled={items.indexOf(item) === items.length - 1}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      </td>
                      <td className="px-1 py-2 w-8">
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab hover:text-gray-600" />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          defaultValue={item.category}
                          onBlur={(e) => updateRow(bucketName, item.id, 'category', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          className="w-full p-1 border rounded bg-white"
                          placeholder="Enter item name"
                        />
                      </td>
                      <td className="px-4 py-2 text-right w-28">
                        <input
                          type="number"
                          defaultValue={item.estBudget}
                          onBlur={(e) => updateRow(bucketName, item.id, 'estBudget', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          className="w-full p-1 border rounded bg-white text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-2 text-right w-28">
                        <input
                          type="number"
                          defaultValue={item.actualCost}
                          onBlur={(e) => handleActualCostBlur(bucketName, item.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          className="w-full p-1 border rounded bg-white text-right"
                          step="0.01"
                          placeholder={item.estBudget > 0 ? `Auto: ${item.estBudget}` : '0'}
                        />
                      </td>
                      <td className="px-4 py-2 w-36">
                        <input
                          type="date"
                          defaultValue={item.dueDate}
                          onBlur={(e) => updateRow(bucketName, item.id, 'dueDate', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          className="w-full p-1 border rounded bg-white"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {item.status === 'paid' && item.previousState ? (
                            <button
                              onClick={() => handleUndoPaid(bucketName, item.id)}
                              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1"
                              title="Undo Payment"
                            >
                              <Undo2 className="w-4 h-4" />
                              Undo
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePaidClick(bucketName, item.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              title="Mark as Paid"
                            >
                              Paid
                            </button>
                          )}
                          
                          <button
                            onClick={() => duplicateItem(bucketName, item.id)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Duplicate Item"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchiveClick(bucketName, item.id)}
                            className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                            title="Archive Item"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(bucketName, item.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          {(item.status === 'paid' || getRowBackgroundColor(item) !== 'bg-white border-gray-200') && (
                            <button
                              onClick={() => handleClearStatus(bucketName, item.id)}
                              className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                              title="Clear Status (Reset to White)"
                            >
                              Clr
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td colSpan="4" className="px-4 py-2 text-right font-semibold text-gray-900">Category Totals:</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">${totalBudgeted.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">${totalActual.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold" colSpan="2">
                    <span className={variance > 0 ? 'text-red-600' : 'text-green-600'}>
                      Variance: {variance > 0 ? '+' : ''}${variance.toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between">
              <button
                onClick={() => addRow(bucketName)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="border border-gray-300 rounded-b-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <span>{filteredItems.length} items</span>
                {statusCounts.overdue > 0 && (
                  <span className="text-red-600 font-medium">{statusCounts.overdue} overdue</span>
                )}
                {statusCounts.pending > 0 && (
                  <span className="text-yellow-600 font-medium">{statusCounts.pending} pending</span>
                )}
              </div>
              <div className="flex gap-4">
                <span>Budgeted: <strong>${totalBudgeted.toFixed(2)}</strong></span>
                <span>Actual: <strong>${totalActual.toFixed(2)}</strong></span>
                <span className={variance > 0 ? 'text-red-600' : 'text-green-600'}>
                  Variance: <strong>{variance > 0 ? '+' : ''}${variance.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer className="py-6">
      <div className="mb-4 bg-transparent">
        <div className="rounded-b-xl border border-transparent bg-transparent px-4 py-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Budget Editor</h2>
          {isSaving && (
            <div className="flex items-center gap-2 text-blue-600 animate-pulse">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <span className="text-sm font-medium">Saving...</span>
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search items by name, budget, or cost..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Status Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
        {[
          { id: 'all', label: 'All Items', color: 'bg-gray-200 text-gray-800' },
          { id: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
          { id: 'pending', label: 'Pending', color: 'bg-blue-100 text-blue-800' },
          { id: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              statusFilter === filter.id 
                ? 'ring-2 ring-blue-500 ' + filter.color
                : filter.color + ' opacity-60 hover:opacity-100'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Bulk Actions & Category Management */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold text-gray-800">Manage Categories & Items</h3>
          {selectedItems.size > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {selectedItems.size} selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            title="Quick Templates"
          >
            <Zap className="w-4 h-4" />
            Templates
          </button>

          {/* Tier 3: Batch Add Mode Toggle */}
          <button
            onClick={() => setBatchAddMode(!batchAddMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
              batchAddMode 
                ? 'bg-orange-600 text-white hover:bg-orange-700' 
                : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
            }`}
            title="Batch Add Mode"
          >
            <ListPlus className="w-4 h-4" />
            Batch Add {batchAddMode && '(ON)'}
          </button>
          
          {selectedItems.size > 0 && (
            <>
              <button
                onClick={bulkArchive}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                title="Archive Selected"
              >
                <Archive className="w-4 h-4" />
                Archive ({selectedItems.size})
              </button>
              <button
                onClick={bulkDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                title="Delete Selected"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedItems.size})
              </button>
            </>
          )}
          <button
            onClick={collapseAll}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            title="Collapse All Categories"
          >
            <ChevronDown className="w-4 h-4" />
            Collapse All
          </button>
          <button
            onClick={expandAll}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            title="Expand All Categories"
          >
            <ChevronUp className="w-4 h-4" />
            Expand All
          </button>
          <button
            onClick={addCategory}
            className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded hover:bg-gray-900"
            title="Add Category"
          >
            <FolderPlus className="w-4 h-4" />
            Add Category
          </button>
          <button
            onClick={deleteCategory}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300"
            title="Delete Category (must be empty)"
          >
            <FolderMinus className="w-4 h-4" />
            Delete Category
          </button>
        </div>
      </div>

      {/* Tier 3: Batch Add Panel */}
      {batchAddMode && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orange-900">Batch Add Mode - Quick Item Entry</h3>
            <button
              onClick={() => setBatchAddMode(false)}
              className="text-orange-600 hover:text-orange-800"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Category</label>
              <select
                value={batchAddCategory}
                onChange={(e) => setBatchAddCategory(e.target.value)}
                className="w-full p-2 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500"
              >
                <option value="">-- Choose Category --</option>
                {categoryOrder.map(key => (
                  <option key={key} value={key}>
                    {categoryNames[key] || DEFAULT_TITLES[key] || key}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <input
                ref={batchItemNameRef}
                type="text"
                placeholder="Enter item name and press Enter"
                disabled={!batchAddCategory}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addBatchItem(e);
                  }
                }}
                className="w-full p-2 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <button
              onClick={addBatchItem}
              disabled={!batchAddCategory}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">💡 Tip: Press Enter after typing item name to quickly add multiple items</p>
        </div>
      )}

      {/* Templates Panel */}
      {showTemplates && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-indigo-900">Quick Templates</h3>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {ITEM_TEMPLATES.map((template, idx) => (
              <button
                key={idx}
                onClick={() => addFromTemplate(template)}
                className="p-3 bg-white border border-indigo-200 rounded hover:bg-indigo-100 text-left transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">{template.name}</div>
                <div className="text-xs text-gray-600 mt-1">${template.estBudget.toFixed(2)}</div>
                <div className="text-xs text-indigo-600 mt-1 capitalize">{template.category}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentlyDeleted && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between">
          <span className="text-sm text-red-800">
            Item deleted successfully!
          </span>
          <button
            onClick={undoDelete}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1"
          >
            <Undo2 className="w-4 h-4" />
            Undelete
          </button>
        </div>
      )}

      {recentlyCleared && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <span className="text-sm text-green-800">
            Row bgcolor reset
          </span>
        </div>
      )}

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Row Color Legend:</h3>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
            Paid
          </span>
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
            Due Soon (≤5 days)
          </span>
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-200 rounded"></div>
            Overdue
          </span>
        </div>
      </div>

      {/* Render categories in custom order */}
      {categoryOrder.map(key => {
        if (!state.buckets[key]) return null;
        const title = DEFAULT_TITLES[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        return (
          <BucketSection
            key={key}
            bucketName={key}
            items={state.buckets[key]}
            title={title}
          />
        );
      })}
    </PageContainer>
  );
};

export default EditorTab;