import React from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock the alerts utility before importing the hook
jest.mock('../../utils/alerts', () => ({
  computeShipmentAlerts: jest.fn(() => []),
  createCustomAlert: jest.fn((severity = 'info', title, description, meta) => ({
    id: `custom-${Date.now()}`,
    severity,
    title,
    description,
    meta: meta || {},
    read: false,
    ts: Date.now(),
  })),
}));

import { useAlerts } from '../useAlerts.js';
import { computeShipmentAlerts } from '../../utils/alerts';

// Use a ref to always capture the latest hook result
const resultRef = { current: {} };

function HookCapture({ shipments }) {
  const result = useAlerts(shipments);
  resultRef.current = result;
  return null;
}

function renderHook(shipments = []) {
  const { rerender, unmount } = render(
    <HookCapture shipments={shipments} />
  );
  return {
    get current() { return resultRef.current; },
    rerender: (newShipments) => rerender(
      <HookCapture shipments={newShipments} />
    ),
    unmount,
  };
}

describe('useAlerts', () => {
  let getItemSpy;
  let setItemSpy;
  let removeItemSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    computeShipmentAlerts.mockReturnValue([]);
    window.localStorage.clear();
    getItemSpy = jest.spyOn(Storage.prototype, 'getItem');
    setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem');
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  describe('initial state', () => {
    it('returns empty alerts array initially', () => {
      const { current } = renderHook([]);
      expect(current.alerts).toEqual([]);
    });

    it('returns handler functions', () => {
      const { current } = renderHook([]);
      expect(typeof current.handleAlertDismiss).toBe('function');
      expect(typeof current.handleAlertMarkRead).toBe('function');
      expect(typeof current.pushAlert).toBe('function');
    });

    it('reads dismissed alerts from localStorage on init', () => {
      window.localStorage.setItem('dismissedAlerts', JSON.stringify(['alert-1', 'alert-2']));
      getItemSpy.mockClear();
      renderHook([]);
      expect(getItemSpy).toHaveBeenCalledWith('dismissedAlerts');
    });
  });

  describe('dismissAlert', () => {
    it('persists dismissed ID to localStorage', () => {
      const { current } = renderHook([]);
      act(() => {
        current.handleAlertDismiss('alert-123');
      });
      expect(setItemSpy).toHaveBeenCalledWith(
        'dismissedAlerts',
        expect.any(String)
      );
      const storedCall = setItemSpy.mock.calls.find(
        (call) => call[0] === 'dismissedAlerts'
      );
      const storedIds = JSON.parse(storedCall[1]);
      expect(storedIds).toContain('alert-123');
    });

    it('removes dismissed alert from alerts array', () => {
      computeShipmentAlerts.mockReturnValue([
        { id: 'a1', severity: 'info', title: 'Test', read: false },
        { id: 'a2', severity: 'warning', title: 'Test2', read: false },
      ]);

      const hook = renderHook([{ id: 1 }]);

      // Wait for useEffect to run with computed alerts
      act(() => { hook.rerender([{ id: 1, _tick: 1 }]); });

      // Verify alerts are present before dismissal
      expect(hook.current.alerts.length).toBe(2);

      act(() => {
        hook.current.handleAlertDismiss('a1');
      });

      expect(hook.current.alerts.find((a) => a.id === 'a1')).toBeUndefined();
      expect(hook.current.alerts.find((a) => a.id === 'a2')).toBeDefined();
    });
  });

  describe('markRead', () => {
    it('updates alert read state to true', () => {
      computeShipmentAlerts.mockReturnValue([
        { id: 'a1', severity: 'info', title: 'Test', read: false },
      ]);

      const hook = renderHook([{ id: 1 }]);
      act(() => { hook.rerender([{ id: 1, _tick: 1 }]); });

      // Verify alert is present and unread
      expect(hook.current.alerts.length).toBe(1);
      expect(hook.current.alerts[0].read).toBe(false);

      act(() => {
        hook.current.handleAlertMarkRead('a1');
      });

      const alert = hook.current.alerts.find((a) => a.id === 'a1');
      expect(alert).toBeDefined();
      expect(alert.read).toBe(true);
    });
  });

  describe('dismissed alerts persistence', () => {
    it('loads previously dismissed IDs from localStorage', () => {
      window.localStorage.setItem('dismissedAlerts', JSON.stringify(['old-1', 'old-2']));
      getItemSpy.mockClear();
      renderHook([]);
      expect(getItemSpy).toHaveBeenCalledWith('dismissedAlerts');
    });

    it('filters out previously dismissed alerts from computed results', () => {
      computeShipmentAlerts.mockReturnValue([
        { id: 'old-1', severity: 'info', title: 'Dismissed', read: false },
        { id: 'new-1', severity: 'warning', title: 'New', read: false },
      ]);

      window.localStorage.setItem('dismissedAlerts', JSON.stringify(['old-1']));

      const hook = renderHook([{ id: 1 }]);
      act(() => { hook.rerender([{ id: 1, _tick: 1 }]); });

      expect(hook.current.alerts.find((a) => a.id === 'old-1')).toBeUndefined();
      expect(hook.current.alerts.find((a) => a.id === 'new-1')).toBeDefined();
    });
  });

  describe('corrupted localStorage', () => {
    it('handles invalid JSON in localStorage gracefully', () => {
      getItemSpy.mockReturnValue('not valid json{{{');
      expect(() => renderHook([])).not.toThrow();
    });

    it('removes corrupted localStorage entry', () => {
      getItemSpy.mockReturnValue('corrupt data!!!');
      renderHook([]);
      expect(removeItemSpy).toHaveBeenCalledWith('dismissedAlerts');
    });

    it('starts with empty dismissed set after corruption', () => {
      computeShipmentAlerts.mockReturnValue([
        { id: 'a1', severity: 'info', title: 'Test', read: false },
      ]);

      getItemSpy.mockReturnValue('corrupted!');

      const hook = renderHook([{ id: 1 }]);
      act(() => { hook.rerender([{ id: 1, _tick: 1 }]); });

      expect(hook.current.alerts.find((a) => a.id === 'a1')).toBeDefined();
    });
  });
});
