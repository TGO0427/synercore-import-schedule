/**
 * Filter Preferences Manager
 * Handles saving and loading filter/search preferences for different views
 */

const STORAGE_KEY = 'synercore_filter_preferences';
const SEARCH_HISTORY_KEY = 'synercore_search_history';

export const filterPreferencesManager = {
  /**
   * Save a filter preset for a specific view
   * @param {string} viewName - Name of the view (e.g., 'shipments', 'warehouse-stored')
   * @param {string} presetName - Name for this preset (e.g., 'Pending Inspections')
   * @param {object} filters - Filter object to save
   */
  savePreset: (viewName, presetName, filters) => {
    try {
      const allPreferences = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

      if (!allPreferences[viewName]) {
        allPreferences[viewName] = {};
      }

      allPreferences[viewName][presetName] = {
        filters,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPreferences));
      return true;
    } catch (error) {
      console.error('Error saving filter preset:', error);
      return false;
    }
  },

  /**
   * Get all saved presets for a view
   * @param {string} viewName - Name of the view
   * @returns {object} Map of preset names to filter objects
   */
  getPresets: (viewName) => {
    try {
      const allPreferences = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return allPreferences[viewName] || {};
    } catch (error) {
      console.error('Error retrieving filter presets:', error);
      return {};
    }
  },

  /**
   * Load a saved filter preset
   * @param {string} viewName - Name of the view
   * @param {string} presetName - Name of the preset to load
   * @returns {object|null} Filter object or null if not found
   */
  loadPreset: (viewName, presetName) => {
    try {
      const presets = filterPreferencesManager.getPresets(viewName);
      if (presets[presetName]) {
        // Update lastUsed timestamp
        const allPreferences = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        allPreferences[viewName][presetName].lastUsed = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allPreferences));

        return presets[presetName].filters;
      }
      return null;
    } catch (error) {
      console.error('Error loading filter preset:', error);
      return null;
    }
  },

  /**
   * Delete a saved filter preset
   * @param {string} viewName - Name of the view
   * @param {string} presetName - Name of the preset to delete
   */
  deletePreset: (viewName, presetName) => {
    try {
      const allPreferences = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (allPreferences[viewName] && allPreferences[viewName][presetName]) {
        delete allPreferences[viewName][presetName];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allPreferences));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting filter preset:', error);
      return false;
    }
  },

  /**
   * Save last used filters for a view (for auto-restore on next visit)
   * @param {string} viewName - Name of the view
   * @param {object} filters - Current filter object
   */
  saveLastUsedFilters: (viewName, filters) => {
    try {
      const lastUsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '{}');
      lastUsed[viewName] = {
        filters,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(lastUsed));
      return true;
    } catch (error) {
      console.error('Error saving last used filters:', error);
      return false;
    }
  },

  /**
   * Get last used filters for a view
   * @param {string} viewName - Name of the view
   * @returns {object|null} Last used filter object or null
   */
  getLastUsedFilters: (viewName) => {
    try {
      const lastUsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '{}');
      return lastUsed[viewName]?.filters || null;
    } catch (error) {
      console.error('Error retrieving last used filters:', error);
      return null;
    }
  },

  /**
   * Add a search term to search history
   * @param {string} viewName - Name of the view
   * @param {string} searchTerm - Search term to save
   */
  addSearchHistory: (viewName, searchTerm) => {
    try {
      if (!searchTerm || searchTerm.trim() === '') return false;

      const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '{}');

      if (!history[`${viewName}_searches`]) {
        history[`${viewName}_searches`] = [];
      }

      // Remove duplicate if exists
      history[`${viewName}_searches`] = history[`${viewName}_searches`].filter(
        term => term.value !== searchTerm
      );

      // Add to beginning
      history[`${viewName}_searches`].unshift({
        value: searchTerm,
        timestamp: new Date().toISOString()
      });

      // Keep only last 20 searches
      history[`${viewName}_searches`] = history[`${viewName}_searches`].slice(0, 20);

      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
      return true;
    } catch (error) {
      console.error('Error adding search history:', error);
      return false;
    }
  },

  /**
   * Get search history for a view
   * @param {string} viewName - Name of the view
   * @returns {array} Array of search terms
   */
  getSearchHistory: (viewName) => {
    try {
      const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '{}');
      return (history[`${viewName}_searches`] || []).map(item => item.value);
    } catch (error) {
      console.error('Error retrieving search history:', error);
      return [];
    }
  }
};

export default filterPreferencesManager;
