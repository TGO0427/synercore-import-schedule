import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { getCurrentWeekNumber } from '../utils/dateUtils';
import { jsPDF } from 'jspdf';
import { ShipmentStatus } from '../types/shipment';

// Helper function to get current month's weeks using consistent week calculation
const getCurrentMonthWeeks = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based

  const weeksInMonth = [];

  // Get first day of current month
  const firstDay = new Date(currentYear, currentMonth, 1);

  // Get last day of current month
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  // Use the same week calculation method as dateUtils.js for consistency
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const firstWeek = getWeekNumber(firstDay);
  const lastWeek = getWeekNumber(lastDay);

  // Add all weeks in the month
  for (let week = firstWeek; week <= lastWeek; week++) {
    weeksInMonth.push(week);
  }

  return weeksInMonth;
};

// Simple input that just works
const SimpleBinInput = ({ warehouseKey, initialValue, maxValue, onUpdate }) => {
  return (
    <input
      key={`${warehouseKey}-simple`}
      type="number"
      defaultValue={initialValue}
      onBlur={(e) => {
        const value = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxValue));
        e.target.value = value;
        onUpdate(warehouseKey, value);
      }}
      onFocus={(e) => e.target.select()}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: '2px solid #ddd',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        color: '#2c3e50',
        width: '70px',
        backgroundColor: 'white'
      }}
      min="0"
      max={maxValue}
    />
  );
};

function WarehouseCapacity({ shipments }) {
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [editableBinsUsed, setEditableBinsUsed] = useState({});
  const editableBinsUsedRef = useRef({});
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(true);

  // Load warehouse capacity data from database on mount
  useEffect(() => {
    const loadCapacityData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const response = await fetch(`${apiUrl}/api/warehouse-capacity`);

        if (response.ok) {
          const data = await response.json();
          setEditableBinsUsed(data);
          editableBinsUsedRef.current = { ...data };
        }
      } catch (error) {
        console.warn('Failed to load warehouse capacity data:', error);
      } finally {
        setIsLoadingCapacity(false);
      }
    };

    loadCapacityData();
  }, []);

  // Memoize current month weeks to avoid recalculating on every render
  const currentMonthWeeks = useMemo(() => getCurrentMonthWeeks(), []);

  const warehouseData = useMemo(() => {
    const currentWeek = getCurrentWeekNumber();
    const baseBinCapacity = 384; // Standard bin capacity per warehouse

    // console.log('WarehouseCapacity: Recalculating warehouse data...', {
    //   currentWeek,
    //   currentMonthWeeks,
    //   totalShipments: shipments.length,
    //   editableBinsUsedKeys: Object.keys(editableBinsUsed)
    // });
    
    // Define warehouse configurations
    const warehouseConfigs = {
      'PRETORIA': { totalBins: 650, avgItemsPerBin: 1 },
      'KLAPMUTS': { totalBins: 384, avgItemsPerBin: 1 },
      'Warehouse A': { totalBins: 384, avgItemsPerBin: 1 },
      'Warehouse B': { totalBins: 384, avgItemsPerBin: 1 },
      'Warehouse C': { totalBins: 384, avgItemsPerBin: 1 },
      'Distribution Center 1': { totalBins: 384, avgItemsPerBin: 1 },
      'Distribution Center 2': { totalBins: 384, avgItemsPerBin: 1 },
      'Regional Hub': { totalBins: 384, avgItemsPerBin: 1 }
    };

    // Calculate current and projected usage
    const warehouseStats = {};

    // Filter shipments to only include those in current month's weeks and exclude stored shipments
    const currentMonthShipments = shipments.filter(shipment => {
      const weekNumber = parseInt(shipment.weekNumber) || currentWeek;
      const isCurrentMonth = currentMonthWeeks.includes(weekNumber);
      const notStored = shipment.latestStatus !== ShipmentStatus.STORED;
      return isCurrentMonth && notStored;
    });

    currentMonthShipments.forEach(shipment => {
      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unassigned';
      // Use palletQty field, or migrate existing CBM values (which were actually pallet quantities)
      const pallets = shipment.palletQty || shipment.cbm || 0;
      const weekNumber = parseInt(shipment.weekNumber) || currentWeek;

      // Debug current week shipments for our target warehouses
      if ((warehouse === 'PRETORIA' || warehouse === 'KLAPMUTS') && weekNumber === currentWeek) {
        console.log(`Processing shipment for ${warehouse}, week ${weekNumber}: ${shipment.productName?.substring(0, 30)} - Status: ${shipment.latestStatus} - Pallets: ${pallets}`);
      }


      if (!warehouseStats[warehouse]) {
        const config = warehouseConfigs[warehouse] || { totalBins: 384, avgItemsPerBin: 1 };
        warehouseStats[warehouse] = {
          totalBins: config.totalBins,
          avgItemsPerBin: config.avgItemsPerBin,
          maxCapacity: config.totalBins * config.avgItemsPerBin,
          currentStock: 0,
          incoming: 0,
          currentWeekIncoming: 0,
          weeklyIncoming: {},
          totalProjected: 0,
          usedBins: 0,
          availableBins: config.totalBins,
          projectedBinsUsed: 0,
          binUtilizationPercent: 0,
          status: 'normal'
        };
      }
      
      // Incoming (all non-arrived shipments) - count pallets
      const arrivedStatuses = ['arrived_pta', 'arrived_klm', 'unloading', 'inspection_pending', 'inspecting', 'inspection_failed', 'inspection_passed', 'receiving', 'received', 'stored'];

      // Current stock (arrived shipments) - count pallets
      if (arrivedStatuses.includes(shipment.latestStatus)) {
        warehouseStats[warehouse].currentStock += pallets;
      }
      const cancelledStatuses = ['cancelled'];
      // Include in_transit_seaway and other transit statuses as incoming
      const isIncoming = !arrivedStatuses.includes(shipment.latestStatus) && !cancelledStatuses.includes(shipment.latestStatus);

      if (isIncoming) {
        // Add to total incoming for the month
        warehouseStats[warehouse].incoming += pallets;

        // Track weekly incoming
        if (!warehouseStats[warehouse].weeklyIncoming[weekNumber]) {
          warehouseStats[warehouse].weeklyIncoming[weekNumber] = 0;
        }
        warehouseStats[warehouse].weeklyIncoming[weekNumber] += pallets;

        // Track current week incoming specifically
        if (weekNumber === currentWeek) {
          if (!warehouseStats[warehouse].currentWeekIncoming) {
            warehouseStats[warehouse].currentWeekIncoming = 0;
          }
          warehouseStats[warehouse].currentWeekIncoming += pallets;
        }
      }
      
      warehouseStats[warehouse].totalProjected = 
        warehouseStats[warehouse].currentStock + warehouseStats[warehouse].incoming;
    });

    // Calculate bin utilization and capacity status
    Object.keys(warehouseStats).forEach(warehouse => {
      const stats = warehouseStats[warehouse];

      // Debug log for PRETORIA and KLAPMUTS
      if (warehouse === 'PRETORIA' || warehouse === 'KLAPMUTS') {
        console.log(`WarehouseCapacity FINAL: ${warehouse} - Total Incoming: ${stats.incoming}, Current Week (${currentWeek}) Incoming: ${stats.currentWeekIncoming || 0}`);
      }
      
      // Use editable bins used if available, otherwise calculate from current stock
      const currentBinsUsed = editableBinsUsed[warehouse] !== undefined 
        ? editableBinsUsed[warehouse] 
        : Math.ceil(stats.currentStock / stats.avgItemsPerBin);
      
      stats.usedBins = currentBinsUsed;
      stats.projectedBinsUsed = currentBinsUsed + Math.ceil(stats.incoming / stats.avgItemsPerBin);
      stats.availableBins = stats.totalBins - currentBinsUsed;  // Currently available bins
      stats.projectedAvailableBins = stats.totalBins - stats.projectedBinsUsed;  // Available after incoming
      stats.binUtilizationPercent = (stats.projectedBinsUsed / stats.totalBins) * 100;
      
      // Capacity status based on bin utilization
      if (stats.binUtilizationPercent >= 95) {
        stats.status = 'critical';
      } else if (stats.binUtilizationPercent >= 80) {
        stats.status = 'warning';
      } else if (stats.binUtilizationPercent >= 60) {
        stats.status = 'good';
      } else {
        stats.status = 'low';
      }
    });


    return { warehouseStats, currentWeek };
  }, [shipments, editableBinsUsed, currentMonthWeeks]);

  const handleBinsUsedChange = useCallback(async (warehouse, newValue) => {
    const updatedBinsUsed = {
      ...editableBinsUsed,
      [warehouse]: newValue
    };

    // Update both state and ref for consistency
    setEditableBinsUsed(updatedBinsUsed);
    editableBinsUsedRef.current[warehouse] = newValue;

    // Save to database
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/warehouse-capacity/${encodeURIComponent(warehouse)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ binsUsed: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to save warehouse capacity');
      }

      console.log(`✓ Saved ${warehouse} bins used: ${newValue}`);
    } catch (error) {
      console.error('Failed to save bins used data to database:', error);
      alert(`Failed to save changes for ${warehouse}. Please try again.`);
    }
  }, [editableBinsUsed]);

  const handleCardClick = useCallback((warehouse) => {
    // Toggle between selected warehouse and "all"
    setSelectedWarehouse(prevSelected => 
      prevSelected === warehouse ? 'all' : warehouse
    );
  }, []);

  const handleExportToPDF = useCallback(() => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Get current week and month weeks for filtering
      const currentWeek = getCurrentWeekNumber();
      const currentMonthWeeks = getCurrentMonthWeeks();

      // Get current date/time
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Header - match the UI exactly
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(44, 62, 80); // Match UI color #2c3e50
      doc.text('🏭 Warehouse Capacity Management', pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(127, 140, 141); // Match UI color #7f8c8d
      doc.text('Monitor warehouse utilization and capacity planning', pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on ${dateStr} at ${timeStr}`, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 20;

      // Get warehouse data exactly as shown in UI
      const warehouses = selectedWarehouse === 'all' 
        ? Object.entries(warehouseData.warehouseStats)
        : Object.entries(warehouseData.warehouseStats).filter(([name]) => name === selectedWarehouse);

      // Warehouse Capacity Cards Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('Warehouse Capacity Status', 20, yPosition);
      yPosition += 15;

      // Create capacity cards exactly like the UI
      warehouses.forEach(([warehouse, stats], index) => {
        // Check for new page
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 20;
        }

        // Card background
        const getStatusColor = (status) => {
          switch (status) {
            case 'critical': return { r: 244, g: 67, b: 54 };
            case 'warning': return { r: 255, g: 152, b: 0 };
            case 'good': return { r: 76, g: 175, b: 80 };
            case 'low': return { r: 33, g: 150, b: 243 };
            default: return { r: 158, g: 158, b: 158 };
          }
        };

        const statusColor = getStatusColor(stats.status);
        const statusText = {
          critical: 'Over Capacity',
          warning: 'Near Capacity', 
          good: 'Good Utilization',
          low: 'Under Utilized'
        }[stats.status] || 'Unknown';

        // Card border (status color)
        doc.setDrawColor(statusColor.r, statusColor.g, statusColor.b);
        doc.setLineWidth(1);
        doc.rect(20, yPosition - 5, pageWidth - 40, 55);

        // Warehouse name and status badge
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(44, 62, 80);
        doc.text(warehouse, 25, yPosition + 5);

        // Status badge
        doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
        doc.rect(pageWidth - 60, yPosition - 2, 35, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(statusText, pageWidth - 42.5, yPosition + 3, { align: 'center' });

        // Bin Utilization Progress Bar
        yPosition += 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Bin Utilization:', 25, yPosition);
        doc.text(`${stats.binUtilizationPercent.toFixed(1)}% (${stats.projectedBinsUsed}/${stats.totalBins} bins)`, 
                 pageWidth - 25, yPosition, { align: 'right' });

        // Progress bar background
        yPosition += 5;
        doc.setFillColor(240, 240, 240);
        doc.rect(25, yPosition - 2, pageWidth - 50, 4, 'F');

        // Progress bar fill
        const barWidth = (pageWidth - 50) * (Math.min(stats.binUtilizationPercent, 100) / 100);
        doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
        doc.rect(25, yPosition - 2, barWidth, 4, 'F');

        // Stats Grid (4 columns like UI)
        yPosition += 12;
        const colWidth = (pageWidth - 50) / 4;

        // Current Bins Utilized
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(102, 102, 102);
        doc.text('Current Bins Utilized', 25, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(44, 62, 80);
        doc.text(`${stats.usedBins} bins`, 25, yPosition + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(136, 136, 136);
        doc.text(`(Stock: ${stats.currentStock.toLocaleString()} pallets)`, 25, yPosition + 10);

        // Incoming
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(102, 102, 102);
        doc.text('Incoming', 25 + colWidth, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 152, 0);
        doc.text(`${stats.incoming.toLocaleString()}`, 25 + colWidth, yPosition + 5);

        // Total Bins
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(102, 102, 102);
        doc.text('Total Bins', 25 + colWidth * 2, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(76, 175, 80);
        doc.text(`${stats.totalBins}`, 25 + colWidth * 2, yPosition + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(136, 136, 136);
        doc.text(`(Max: ${stats.maxCapacity.toLocaleString()} pallets)`, 25 + colWidth * 2, yPosition + 10);

        // Available Bins
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(102, 102, 102);
        doc.text('Available Bins', 25 + colWidth * 3, yPosition);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(stats.availableBins >= 0 ? 76 : 244, stats.availableBins >= 0 ? 175 : 67, stats.availableBins >= 0 ? 80 : 54);
        doc.text(stats.availableBins >= 0 ? `${stats.availableBins}` : `(${Math.abs(stats.availableBins)})`, 
                 25 + colWidth * 3, yPosition + 5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(136, 136, 136);
        doc.text(`After incoming: ${stats.projectedAvailableBins >= 0 ? stats.projectedAvailableBins : `(${Math.abs(stats.projectedAvailableBins)})`}`, 
                 25 + colWidth * 3, yPosition + 10);

        yPosition += 25;
      });

      // Add capacity status overview like in UI
      if (warehouses.length > 1) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 20;
        }

        yPosition += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('🎯 Capacity Status Distribution', 20, yPosition);
        yPosition += 15;

        const statusCounts = warehouses.reduce((acc, [_, stats]) => {
          acc[stats.status] = (acc[stats.status] || 0) + 1;
          return acc;
        }, {});

        const statusData = [
          { status: 'critical', label: 'Over Capacity', color: { r: 244, g: 67, b: 54 }, count: statusCounts.critical || 0 },
          { status: 'warning', label: 'Near Capacity', color: { r: 255, g: 152, b: 0 }, count: statusCounts.warning || 0 },
          { status: 'good', label: 'Good Utilization', color: { r: 76, g: 175, b: 80 }, count: statusCounts.good || 0 },
          { status: 'low', label: 'Under Utilized', color: { r: 33, g: 150, b: 243 }, count: statusCounts.low || 0 }
        ];

        statusData.forEach((item, index) => {
          const xPos = 20 + (index * 45);
          const percentage = warehouses.length > 0 ? (item.count / warehouses.length) * 100 : 0;

          // Status circle
          doc.setFillColor(item.color.r, item.color.g, item.color.b);
          doc.circle(xPos + 10, yPosition + 5, 8, 'F');
          
          // Count in circle
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(255, 255, 255);
          doc.text(item.count.toString(), xPos + 10, yPosition + 7, { align: 'center' });

          // Label
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(44, 62, 80);
          doc.text(item.label, xPos + 10, yPosition + 18, { align: 'center' });
          doc.setFontSize(8);
          doc.setTextColor(102, 102, 102);
          doc.text(`${percentage.toFixed(1)}%`, xPos + 10, yPosition + 23, { align: 'center' });
        });

        yPosition += 35;
      }

      // Add Bin Utilization Overview (like the chart in UI)
      if (yPosition > pageHeight - 100) {
        doc.addPage();
        yPosition = 20;
      }

      yPosition += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('📊 Bin Utilization Overview', 20, yPosition);
      yPosition += 15;

      // Sort warehouses by utilization like in UI
      const sortedWarehouses = [...warehouses].sort((a, b) => b[1].binUtilizationPercent - a[1].binUtilizationPercent);

      sortedWarehouses.forEach(([warehouse, stats]) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }

        const percentage = stats.binUtilizationPercent;
        const getColor = () => {
          if (percentage >= 95) return { r: 244, g: 67, b: 54 };
          if (percentage >= 80) return { r: 255, g: 152, b: 0 };
          if (percentage >= 60) return { r: 76, g: 175, b: 80 };
          return { r: 33, g: 150, b: 243 };
        };
        const color = getColor();

        // Warehouse name
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(warehouse.length > 20 ? warehouse.substring(0, 20) + '...' : warehouse, 25, yPosition);

        // Progress bar background
        doc.setFillColor(240, 240, 240);
        doc.rect(85, yPosition - 3, 80, 6, 'F');

        // Progress bar fill
        const barWidth = 80 * (Math.min(percentage, 100) / 100);
        doc.setFillColor(color.r, color.g, color.b);
        doc.rect(85, yPosition - 3, barWidth, 6, 'F');

        // Percentage text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(percentage > 50 ? 255 : 51, percentage > 50 ? 255 : 51, percentage > 50 ? 255 : 51);
        doc.text(`${percentage.toFixed(1)}%`, 125, yPosition + 1, { align: 'center' });

        // Bins ratio
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        doc.text(`${stats.projectedBinsUsed}/${stats.totalBins} bins`, 175, yPosition);

        yPosition += 10;
      });

      // Add Weekly Capacity Inflow (like the table in UI)
      if (yPosition > pageHeight - 100) {
        doc.addPage();
        yPosition = 20;
      }

      yPosition += 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text('📈 Weekly Capacity Inflow (Pallets) - Current Month', 20, yPosition);
      yPosition += 15;

      // Get current month weeks from warehouse stats
      const allWeeks = new Set();
      Object.values(warehouseData.warehouseStats).forEach(stats => {
        Object.keys(stats.weeklyIncoming).forEach(week => {
          const weekNum = parseInt(week);
          if (currentMonthWeeks.includes(weekNum)) {
            allWeeks.add(weekNum);
          }
        });
      });
      const weeks = Array.from(allWeeks).sort((a, b) => a - b); // Show all current month weeks

      if (weeks.length > 0) {
        // Table header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(68, 114, 196);
        
        const colWidth = (pageWidth - 60) / (weeks.length + 1);
        doc.rect(20, yPosition - 5, colWidth, 8, 'F');
        doc.text('Warehouse', 20 + colWidth/2, yPosition, { align: 'center' });
        
        weeks.forEach((week, index) => {
          doc.rect(20 + colWidth * (index + 1), yPosition - 5, colWidth, 8, 'F');
          doc.text(`Week ${week}`, 20 + colWidth * (index + 1) + colWidth/2, yPosition, { align: 'center' });
        });
        
        yPosition += 10;

        // Table rows
        Object.entries(warehouseData.warehouseStats).forEach(([warehouse, stats], rowIndex) => {
          if (yPosition > pageHeight - 15) {
            doc.addPage();
            yPosition = 20;
          }

          // Alternating row colors
          if (rowIndex % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(20, yPosition - 5, pageWidth - 40, 8, 'F');
          }

          // Warehouse name
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(44, 62, 80);
          const warehouseName = warehouse.length > 12 ? warehouse.substring(0, 12) + '...' : warehouse;
          doc.text(warehouseName, 20 + colWidth/2, yPosition, { align: 'center' });

          // Week data
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          weeks.forEach((week, index) => {
            const amount = stats.weeklyIncoming[week] || 0;
            const text = amount > 0 ? amount.toLocaleString() : '-';
            if (amount > 0) {
              doc.setFillColor(227, 242, 253);
              doc.rect(20 + colWidth * (index + 1), yPosition - 5, colWidth, 8, 'F');
            }
            doc.text(text, 20 + colWidth * (index + 1) + colWidth/2, yPosition, { align: 'center' });
          });

          yPosition += 8;
        });
      }

      // Add Incoming Products Summary (like ProductBreakdownChart) - Current Month Only, excluding stored shipments
      const incomingShipments = shipments.filter(shipment => {
        const isIncoming = shipment.latestStatus === 'planned_airfreight' || shipment.latestStatus === 'planned_seafreight' ||
          shipment.latestStatus === 'in_transit_airfreight' || shipment.latestStatus === 'in_transit_roadway' ||
          shipment.latestStatus === 'in_transit_seaway';

        const weekNumber = parseInt(shipment.weekNumber) || currentWeek;
        const isCurrentMonth = currentMonthWeeks.includes(weekNumber);
        const notStored = shipment.latestStatus !== ShipmentStatus.STORED;

        return isIncoming && isCurrentMonth && notStored;
      });

      if (incomingShipments.length > 0) {
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 20;
        }

        yPosition += 15;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('📋 Incoming Products Summary', 20, yPosition);
        yPosition += 15;

        // Summary stats like in UI
        const totalProducts = incomingShipments.length;
        const totalPalletsFromQty = incomingShipments.reduce((sum, s) => sum + (s.palletQty || 0), 0);
        const totalQuantity = incomingShipments.reduce((sum, s) => sum + (s.quantity || 0), 0);
        const totalPallets = incomingShipments.reduce((sum, s) => {
          return sum + (s.palletQty || s.cbm || 0);
        }, 0);

        // Summary boxes (4 across)
        const boxWidth = (pageWidth - 50) / 4;
        const summaryData = [
          { value: totalProducts, label: 'Total Products', color: { r: 33, g: 150, b: 243 } },
          { value: totalPalletsFromQty.toFixed(0), label: 'Total Pallet Qty', color: { r: 76, g: 175, b: 80 } },
          { value: totalQuantity.toLocaleString(), label: 'Total Tonnage', color: { r: 255, g: 152, b: 0 } },
          { value: totalPallets.toLocaleString(), label: 'Estimated Pallets', color: { r: 156, g: 39, b: 176 } }
        ];

        summaryData.forEach((item, index) => {
          const xPos = 25 + (boxWidth * index);
          
          // Background
          doc.setFillColor(248, 249, 250);
          doc.rect(xPos, yPosition - 5, boxWidth - 5, 25, 'F');
          doc.setDrawColor(225, 225, 225);
          doc.rect(xPos, yPosition - 5, boxWidth - 5, 25);

          // Value
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(item.color.r, item.color.g, item.color.b);
          doc.text(item.value.toString(), xPos + (boxWidth - 5)/2, yPosition + 5, { align: 'center' });

          // Label
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(102, 102, 102);
          doc.text(item.label, xPos + (boxWidth - 5)/2, yPosition + 12, { align: 'center' });
        });

        yPosition += 30;
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text('Synercore Import Schedule - Warehouse Capacity Management', pageWidth / 2, pageHeight - 5, { align: 'center' });
      }

      // Generate filename
      const dateForFile = now.toISOString().split('T')[0];
      const timeForFile = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const warehouseFilter = selectedWarehouse === 'all' ? 'All_Warehouses' : selectedWarehouse.replace(/\s+/g, '_');
      const filename = `Warehouse_Capacity_${warehouseFilter}_${dateForFile}_${timeForFile}.pdf`;

      // Save the PDF
      doc.save(filename);
      
      console.log(`Warehouse capacity data exported: ${filename}`);
      console.log(`Contains data for: ${selectedWarehouse === 'all' ? warehouses.length + ' warehouses' : selectedWarehouse}`);
    } catch (error) {
      console.error('Error exporting warehouse capacity data:', error);
      alert('Failed to export warehouse capacity data. Please try again.');
    }
  }, [warehouseData, selectedWarehouse, shipments]);


  const CapacityCard = React.memo(({ warehouse, stats, onBinsUsedChange, onCardClick, isSelected }) => {
    const utilizationPercent = stats.binUtilizationPercent;
    const availableCapacity = stats.maxCapacity - stats.totalProjected;
    
    const getStatusColor = (status) => {
      switch (status) {
        case 'critical': return '#f44336';
        case 'warning': return '#ff9800';
        case 'good': return '#4caf50';
        case 'low': return '#2196f3';
        default: return '#9e9e9e';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'critical': return 'Over Capacity';
        case 'warning': return 'Near Capacity';
        case 'good': return 'Good Utilization';
        case 'low': return 'Under Utilized';
        default: return 'Unknown';
      }
    };

    return (
      <div 
        className="capacity-card" 
        onClick={() => onCardClick && onCardClick(warehouse)}
        style={{
          backgroundColor: isSelected ? '#f8f9ff' : 'white',
          border: `3px solid ${getStatusColor(stats.status)}`,
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: isSelected ? '0 8px 20px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
          cursor: onCardClick ? 'pointer' : 'default',
          transform: isSelected ? 'translateY(-2px)' : 'none'
        }}
        onMouseEnter={(e) => {
          if (onCardClick && !isSelected) {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
          }
        }}
        onMouseLeave={(e) => {
          if (onCardClick && !isSelected) {
            e.target.style.transform = 'none';
            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          }
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ color: '#2c3e50', fontSize: '1.2rem', margin: 0 }}>{warehouse}</h3>
          <span style={{
            backgroundColor: getStatusColor(stats.status),
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}>
            {getStatusText(stats.status)}
          </span>
        </div>

        {/* Bin Utilization Bar */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Bin Utilization</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: getStatusColor(stats.status) }}>
              {utilizationPercent.toFixed(1)}% ({stats.projectedBinsUsed}/{stats.totalBins} bins)
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: '#f0f0f0',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              width: `${Math.min(utilizationPercent, 100)}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${getStatusColor(stats.status)}22, ${getStatusColor(stats.status)})`,
              borderRadius: '10px',
              transition: 'width 0.5s ease'
            }}></div>
            {utilizationPercent > 100 && (
              <div style={{
                position: 'absolute',
                right: '5px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                color: '#f44336'
              }}>
                OVERFLOW
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
          <div>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Current Bins Utilized</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SimpleBinInput 
                warehouseKey={warehouse}
                initialValue={editableBinsUsed[warehouse] !== undefined ? editableBinsUsed[warehouse] : stats.usedBins}
                maxValue={stats.totalBins}
                onUpdate={onBinsUsedChange}
              />
              <span style={{ fontSize: '0.9rem', color: '#666' }}>bins</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
              (Stock: {stats.currentStock.toLocaleString()} pallets)
            </div>
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Incoming (Week {warehouseData.currentWeek}) 🔄</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#ff9800' }}>
              {(stats.currentWeekIncoming || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
              (Month total: {stats.incoming.toLocaleString()})
            </div>
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Total Bins</div>
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4caf50' }}>
              {stats.totalBins}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>
              (Max: {stats.maxCapacity.toLocaleString()} pallets)
            </div>
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Available Bins</div>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '1.1rem', 
              color: stats.availableBins >= 0 ? '#4caf50' : '#f44336' 
            }}>
              {stats.availableBins >= 0 ? stats.availableBins : `(${Math.abs(stats.availableBins)})`}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>
              After incoming: {stats.projectedAvailableBins >= 0 ? stats.projectedAvailableBins : `(${Math.abs(stats.projectedAvailableBins)})`}
            </div>
          </div>
        </div>
      </div>
    );
  });

  const WeeklyInflowChart = ({ warehouseStats }) => {
    const currentMonthWeeks = getCurrentMonthWeeks();

    // Filter to only show weeks that have data and are in current month
    const allWeeks = new Set();
    Object.values(warehouseStats).forEach(stats => {
      Object.keys(stats.weeklyIncoming).forEach(week => {
        const weekNum = parseInt(week);
        if (currentMonthWeeks.includes(weekNum)) {
          allWeeks.add(weekNum);
        }
      });
    });

    const weeks = Array.from(allWeeks).sort((a, b) => a - b);
    const warehouses = Object.keys(warehouseStats);

    return (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>📈 Weekly Capacity Inflow (Pallets) - Current Month</h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Warehouse</th>
                {weeks.map(week => (
                  <th key={week} style={{ 
                    padding: '12px', 
                    textAlign: 'center', 
                    border: '1px solid #dee2e6',
                    minWidth: '80px'
                  }}>
                    Week {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warehouses.map(warehouse => (
                <tr key={warehouse}>
                  <td style={{ 
                    padding: '12px', 
                    fontWeight: 'bold', 
                    border: '1px solid #dee2e6',
                    backgroundColor: '#f8f9fc'
                  }}>
                    {warehouse}
                  </td>
                  {weeks.map(week => {
                    const amount = warehouseStats[warehouse].weeklyIncoming[week] || 0;
                    return (
                      <td key={week} style={{ 
                        padding: '12px', 
                        textAlign: 'center', 
                        border: '1px solid #dee2e6',
                        backgroundColor: amount > 0 ? '#e3f2fd' : 'white'
                      }}>
                        {amount > 0 ? amount.toLocaleString() : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const CapacityUtilizationChart = ({ warehouseStats }) => {
    const warehouses = Object.entries(warehouseStats).sort((a, b) => b[1].binUtilizationPercent - a[1].binUtilizationPercent);
    const maxUtil = Math.max(...warehouses.map(([_, stats]) => stats.binUtilizationPercent));
    
    return (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>📊 Bin Utilization Overview</h3>
        
        <div style={{ display: 'grid', gap: '1rem' }}>
          {warehouses.map(([warehouse, stats]) => {
            const percentage = stats.binUtilizationPercent;
            const getColor = () => {
              if (percentage >= 95) return '#f44336';
              if (percentage >= 80) return '#ff9800';
              if (percentage >= 60) return '#4caf50';
              return '#2196f3';
            };
            
            return (
              <div key={warehouse} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ minWidth: '140px', fontSize: '0.9rem', fontWeight: '500' }}>
                  {warehouse}
                </div>
                <div style={{ flex: 1, position: 'relative', height: '30px', backgroundColor: '#f0f0f0', borderRadius: '15px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(percentage, 100)}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${getColor()}22, ${getColor()})`,
                    borderRadius: '15px',
                    transition: 'width 0.8s ease'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: percentage > 50 ? 'white' : '#333'
                  }}>
                    {percentage.toFixed(1)}%
                  </div>
                </div>
                <div style={{ minWidth: '100px', fontSize: '0.8rem', textAlign: 'right', color: '#666' }}>
                  {stats.projectedBinsUsed}/{stats.totalBins} bins
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const ProductETAChart = ({ shipments }) => {
    const currentWeek = getCurrentWeekNumber();
    const currentMonthWeeks = getCurrentMonthWeeks();

    // Create individual product entries with their ETA week

    const productData = shipments
      .filter(shipment => {
        // Show products with product names and within current month weeks, excluding stored shipments
        const hasProduct = shipment.productName && shipment.productName.trim() !== '';
        const weekNumber = parseInt(shipment.weekNumber) || currentWeek;
        const isCurrentMonth = currentMonthWeeks.includes(weekNumber);
        const notStored = shipment.latestStatus !== ShipmentStatus.STORED;
        return hasProduct && isCurrentMonth && notStored;
      })
      .map(shipment => ({
        name: shipment.productName || 'Unknown Product',
        quantity: shipment.quantity || 0,
        palletQty: shipment.palletQty || shipment.cbm || 0,
        warehouse: shipment.receivingWarehouse || shipment.finalPod || 'Unassigned',
        weekNumber: shipment.weekNumber || currentWeek,
        id: shipment.id
      }))
      .sort((a, b) => {
        // Sort by week first, then by quantity descending
        if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
        return b.quantity - a.quantity;
      })
      .slice(0, 15); // Show top 15 products
    
    const maxQuantity = Math.max(...productData.map(product => product.quantity));
    
    const getWarehouseColor = (warehouse) => {
      const warehouseLower = warehouse.toLowerCase();
      if (warehouseLower.includes('pretoria')) return '#2196f3'; // Blue for Pretoria
      if (warehouseLower.includes('klapmuts')) return '#4caf50'; // Green for Klapmuts
      return '#ff9800'; // Orange for other/unassigned warehouses
    };
    
    return (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginTop: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#2c3e50', margin: 0 }}>📦 Products by ETA Week</h3>
          
          {/* Color Legend */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                backgroundColor: '#2196f3', 
                borderRadius: '3px',
                border: '1px solid #ddd'
              }}></div>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>Pretoria</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                backgroundColor: '#4caf50', 
                borderRadius: '3px',
                border: '1px solid #ddd'
              }}></div>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>Klapmuts</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ 
                width: '16px', 
                height: '16px', 
                backgroundColor: '#ff9800', 
                borderRadius: '3px',
                border: '1px solid #ddd'
              }}></div>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>Other</span>
            </div>
          </div>
        </div>
        
        {productData.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            color: '#666',
            fontStyle: 'italic',
            fontSize: '1.1rem'
          }}>
            No products with ETA found
          </div>
        ) : (
          <div>
            {/* Bar Chart */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              gap: '8px', 
              height: '300px',
              marginBottom: '2rem',
              padding: '0 20px',
              overflowX: 'auto'
            }}>
              {productData.map((product, index) => {
                const barHeight = maxQuantity > 0 ? (product.quantity / maxQuantity) * 260 : 0;
                const isCurrentWeek = product.weekNumber === currentWeek;
                const warehouseColor = getWarehouseColor(product.warehouse);
                
                return (
                  <div 
                    key={`${product.id}-${index}`}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      minWidth: '100px',
                      flex: '0 0 auto'
                    }}
                  >
                    {/* Bar */}
                    <div style={{ 
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'flex-end',
                      height: '260px',
                      width: '100%'
                    }}>
                      <div style={{
                        width: '100%',
                        height: `${barHeight}px`,
                        background: `linear-gradient(180deg, ${warehouseColor}22, ${warehouseColor})`,
                        borderRadius: '8px 8px 4px 4px',
                        border: `2px solid ${warehouseColor}`,
                        position: 'relative',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}>
                        {/* Quantity label on bar */}
                        <div style={{
                          position: 'absolute',
                          top: '-35px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          color: warehouseColor,
                          whiteSpace: 'nowrap'
                        }}>
                          {product.quantity.toLocaleString()}
                        </div>
                        
                        {/* Week number indicator */}
                        <div style={{
                          position: 'absolute',
                          top: '4px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          color: 'white',
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          whiteSpace: 'nowrap'
                        }}>
                          W{product.weekNumber}
                        </div>
                        
                        {/* Pallet Qty indicator */}
                        {product.palletQty > 0 && (
                          <div style={{
                            position: 'absolute',
                            bottom: '4px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            color: 'white',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            padding: '1px 4px',
                            borderRadius: '6px'
                          }}>
                            {product.palletQty} pallets
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Product name label */}
                    <div style={{
                      marginTop: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      color: '#333',
                      textAlign: 'center',
                      maxWidth: '100px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: '1.2'
                    }} title={product.name}>
                      {product.name}
                    </div>
                    
                    {/* Warehouse label */}
                    <div style={{
                      fontSize: '0.7rem',
                      color: '#666',
                      textAlign: 'center',
                      marginTop: '2px'
                    }}>
                      {product.warehouse}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Product Details Table */}
            <div style={{ 
              maxHeight: '400px', 
              overflowY: 'auto',
              border: '1px solid #e1e5e9',
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Product Name</th>
                    <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #dee2e6' }}>ETA Week</th>
                    <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #dee2e6' }}>Quantity</th>
                    <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #dee2e6' }}>Pallet Qty</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Warehouse</th>
                  </tr>
                </thead>
                <tbody>
                  {productData.map((product, index) => {
                    const isCurrentWeek = product.weekNumber === currentWeek;
                    const warehouseColor = getWarehouseColor(product.warehouse);
                    
                    return (
                      <tr key={`${product.id}-${index}`} style={{ 
                        backgroundColor: isCurrentWeek ? '#f0f8f0' : 'white'
                      }}>
                        <td style={{ 
                          padding: '10px 12px', 
                          border: '1px solid #dee2e6',
                          fontWeight: '500'
                        }}>
                          {product.name}
                        </td>
                        <td style={{ 
                          padding: '10px 12px', 
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          fontWeight: isCurrentWeek ? 'bold' : 'normal',
                          color: '#333'
                        }}>
                          {isCurrentWeek ? `${product.weekNumber} (Current)` : product.weekNumber}
                        </td>
                        <td style={{ 
                          padding: '10px 12px', 
                          border: '1px solid #dee2e6', 
                          textAlign: 'center',
                          fontWeight: '500'
                        }}>
                          {product.quantity.toLocaleString()}
                        </td>
                        <td style={{ 
                          padding: '10px 12px', 
                          border: '1px solid #dee2e6', 
                          textAlign: 'center',
                          color: '#666'
                        }}>
                          {product.palletQty > 0 ? product.palletQty : '-'}
                        </td>
                        <td style={{ 
                          padding: '10px 12px', 
                          border: '1px solid #dee2e6',
                          fontSize: '0.9rem',
                          color: warehouseColor,
                          fontWeight: '500'
                        }}>
                          {product.warehouse}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ProductBreakdownChart = ({ shipments }) => {
    const currentWeek = getCurrentWeekNumber();
    const currentMonthWeeks = getCurrentMonthWeeks();

    // Filter to show only planned and in-transit shipments (incoming) within current month, excluding stored shipments
    const incomingShipments = shipments.filter(shipment => {
      const isIncoming = shipment.latestStatus === 'planned_airfreight' || shipment.latestStatus === 'planned_seafreight' ||
        shipment.latestStatus === 'in_transit_airfreight' || shipment.latestStatus === 'in_transit_roadway' ||
        shipment.latestStatus === 'in_transit_seaway';

      const weekNumber = parseInt(shipment.weekNumber) || currentWeek;
      const isCurrentMonth = currentMonthWeeks.includes(weekNumber);
      const notStored = shipment.latestStatus !== ShipmentStatus.STORED;

      return isIncoming && isCurrentMonth && notStored;
    });
    
    // Group by warehouse and aggregate data
    const warehouseData = incomingShipments.reduce((acc, shipment) => {
      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unassigned';
      const quantity = shipment.quantity || 0;
      const pallets = shipment.palletQty || shipment.cbm || 0;
      
      if (!acc[warehouse]) {
        acc[warehouse] = { palletQty: 0, quantity: 0, pallets: 0, products: [] };
      }

      acc[warehouse].palletQty += shipment.palletQty || 0;
      acc[warehouse].quantity += quantity;
      acc[warehouse].pallets += pallets;
      acc[warehouse].products.push({
        name: shipment.productName || 'Unknown Product',
        palletQty: shipment.palletQty || shipment.cbm || 0,
        quantity: quantity,
        pallets: pallets,
        status: shipment.latestStatus
      });
      
      return acc;
    }, {});
    
    const warehouses = Object.entries(warehouseData);
    const maxPalletQty = Math.max(...warehouses.map(([_, data]) => data.palletQty));
    const maxQuantity = Math.max(...warehouses.map(([_, data]) => data.quantity));
    const maxPallets = Math.max(...warehouses.map(([_, data]) => data.pallets));
    
    const getWarehouseColor = (warehouse) => {
      switch (warehouse) {
        case 'PRETORIA': return '#4caf50';
        case 'KLAPMUTS': return '#2196f3';
        case 'Unassigned': return '#f44336';
        default: return '#9e9e9e';
      }
    };
    
    return (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>📋 Incoming Products by Warehouse</h3>
        
        {warehouses.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            color: '#666',
            fontStyle: 'italic',
            fontSize: '1.1rem'
          }}>
            No incoming shipments found
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '2rem' }}>
            {/* Quantity Chart */}
            <div>
              <h4 style={{ color: '#2c3e50', marginBottom: '1rem', fontSize: '1.1rem' }}>📊 Quantity by Warehouse</h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {warehouses.map(([warehouse, data]) => (
                  <div key={`qty-${warehouse}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ minWidth: '120px', fontWeight: '500', fontSize: '0.9rem' }}>
                      {warehouse}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '35px', backgroundColor: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${maxQuantity > 0 ? (data.quantity / maxQuantity) * 100 : 0}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, #ff980022, #ff9800)`,
                        borderRadius: '8px',
                        transition: 'width 0.8s ease',
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          color: data.quantity > maxQuantity * 0.5 ? 'white' : '#ff9800'
                        }}>
                          {data.quantity.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ minWidth: '80px', fontSize: '0.8rem', color: '#666' }}>
                      tonnage
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Pallets Chart */}
            <div>
              <h4 style={{ color: '#2c3e50', marginBottom: '1rem', fontSize: '1.1rem' }}>🚛 Pallets by Warehouse</h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {warehouses.map(([warehouse, data]) => (
                  <div key={`pallets-${warehouse}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ minWidth: '120px', fontWeight: '500', fontSize: '0.9rem' }}>
                      {warehouse}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: '35px', backgroundColor: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${maxPallets > 0 ? (data.pallets / maxPallets) * 100 : 0}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, #9c27b022, #9c27b0)`,
                        borderRadius: '8px',
                        transition: 'width 0.8s ease',
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          color: 'white',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
                        }}>
                          {data.pallets.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ minWidth: '80px', fontSize: '0.8rem', color: '#666' }}>
                      pallets
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Summary Stats */}
            <div style={{ 
              padding: '1.5rem', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '12px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginTop: '1rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196f3', marginBottom: '0.5rem' }}>
                  {incomingShipments.length}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                  Total Products
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4caf50', marginBottom: '0.5rem' }}>
                  {incomingShipments.reduce((sum, s) => sum + (s.palletQty || 0), 0).toFixed(0)}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                  Total Pallet Qty
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff9800', marginBottom: '0.5rem' }}>
                  {incomingShipments.reduce((sum, s) => sum + (s.quantity || 0), 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                  Total Tonnage
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#9c27b0', marginBottom: '0.5rem' }}>
                  {incomingShipments.reduce((sum, s) => {
                    return sum + (s.palletQty || s.cbm || 0);
                  }, 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>
                  Total Pallets
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const CapacityStatusOverview = ({ warehouseStats }) => {
    const statusCounts = Object.values(warehouseStats).reduce((acc, stats) => {
      acc[stats.status] = (acc[stats.status] || 0) + 1;
      return acc;
    }, {});
    
    const statusData = [
      { status: 'critical', label: 'Over Capacity', color: '#f44336', count: statusCounts.critical || 0 },
      { status: 'warning', label: 'Near Capacity', color: '#ff9800', count: statusCounts.warning || 0 },
      { status: 'good', label: 'Good Utilization', color: '#4caf50', count: statusCounts.good || 0 },
      { status: 'low', label: 'Under Utilized', color: '#2196f3', count: statusCounts.low || 0 }
    ];
    
    const totalWarehouses = Object.keys(warehouseStats).length;
    
    return (
      <div style={{ 
        backgroundColor: 'white', 
        padding: '2rem', 
        borderRadius: '12px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        marginTop: '2rem'
      }}>
        <h3 style={{ color: '#2c3e50', marginBottom: '1.5rem' }}>🎯 Capacity Status Distribution</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {statusData.map(({ status, label, color, count }) => {
            const percentage = totalWarehouses > 0 ? (count / totalWarehouses) * 100 : 0;
            
            return (
              <div key={status} style={{ 
                textAlign: 'center', 
                padding: '1.5rem',
                borderRadius: '12px',
                backgroundColor: `${color}11`,
                border: `2px solid ${color}33`
              }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  backgroundColor: color,
                  margin: '0 auto 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {count}
                </div>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#2c3e50' }}>{label}</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>{percentage.toFixed(1)}% of warehouses</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const filteredWarehouses = selectedWarehouse === 'all'
    ? Object.entries(warehouseData.warehouseStats)
    : Object.entries(warehouseData.warehouseStats).filter(([name]) => name === selectedWarehouse);

  // Filter warehouse stats for charts
  const filteredWarehouseStats = selectedWarehouse === 'all'
    ? warehouseData.warehouseStats
    : Object.fromEntries(filteredWarehouses);

  // Filter shipments for charts based on selected warehouse
  const filteredShipments = selectedWarehouse === 'all'
    ? shipments
    : shipments.filter(shipment => {
        const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unassigned';
        return warehouse === selectedWarehouse;
      });

  return (
    <div style={{ padding: '2rem', backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>
          🏭 Warehouse Capacity Management
          {selectedWarehouse !== 'all' && (
            <span style={{ color: '#667eea', fontSize: '0.8em', marginLeft: '0.5rem' }}>
              - {selectedWarehouse}
            </span>
          )}
        </h2>
        <p style={{ color: '#7f8c8d' }}>
          {selectedWarehouse === 'all'
            ? 'Monitor warehouse utilization and capacity planning across all warehouses'
            : `Detailed view for ${selectedWarehouse} warehouse - Click another warehouse card or select "All Warehouses" to change view`
          }
        </p>
      </div>

      {/* Controls */}
      <div style={{ 
        marginBottom: '2rem', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <select 
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '2px solid #667eea',
            backgroundColor: 'white',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Warehouses</option>
          {Object.keys(warehouseData.warehouseStats).map(warehouse => (
            <option key={warehouse} value={warehouse}>{warehouse}</option>
          ))}
        </select>

        <button
          onClick={handleExportToPDF}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#e53e3e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#c53030';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#e53e3e';
            e.target.style.transform = 'none';
            e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          }}
          title={`Export warehouse capacity report to PDF (${Object.keys(warehouseData.warehouseStats).length} warehouses)`}
        >
          📄 Export PDF Report
        </button>
      </div>

      {/* Capacity Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {filteredWarehouses.map(([warehouse, stats]) => (
          <CapacityCard 
            key={warehouse} 
            warehouse={warehouse} 
            stats={stats} 
            onBinsUsedChange={handleBinsUsedChange}
            onCardClick={handleCardClick}
            isSelected={selectedWarehouse === warehouse}
          />
        ))}
      </div>

      {/* Analytics Charts - Filtered by Selected Warehouse */}
      <CapacityStatusOverview warehouseStats={filteredWarehouseStats} />
      <CapacityUtilizationChart warehouseStats={filteredWarehouseStats} />
      <ProductETAChart shipments={filteredShipments} />
      <ProductBreakdownChart shipments={filteredShipments} />
      <WeeklyInflowChart warehouseStats={filteredWarehouseStats} />
    </div>
  );
}

export default WarehouseCapacity;