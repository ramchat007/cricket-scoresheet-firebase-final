// helpers.js
export const isTab = (currentTab, tabName) => currentTab === tabName;

export const formatCurrency = (val) => `₹${(val || 0).toLocaleString()}`;
