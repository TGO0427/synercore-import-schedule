import React, { useState, useEffect } from 'react';
import { getWeekNumber, formatDate, getCurrentWeekNumber, getWeekDateRange } from '../utils/dateUtils';

function WeekCalendar({ onWeekSelect, currentWeek, selectedWeekDate }) {
  const [selectedDate, setSelectedDate] = useState(
    selectedWeekDate ? new Date(selectedWeekDate) : null
  );
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek || getCurrentWeekNumber());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    setSelectedWeek(currentWeek || getCurrentWeekNumber());
  }, [currentWeek]);

  useEffect(() => {
    if (selectedWeekDate) {
      setSelectedDate(new Date(selectedWeekDate));
    }
  }, [selectedWeekDate]);

  const handleDateClick = (date) => {
    const weekNumber = getWeekNumber(date);

    setSelectedDate(date);
    setSelectedWeek(weekNumber);

    if (onWeekSelect) {
      onWeekSelect(weekNumber, date);
    }

    setShowCalendar(false);
  };

  const handleDateChange = (event) => {
    const dateValue = event.target.value;
    if (dateValue) {
      const date = new Date(dateValue);
      handleDateClick(date);
    }
  };

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + direction);
      return newMonth;
    });
  };

  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    
    const days = [];
    
    // Previous month's days
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected: selectedDate && date.toDateString() === selectedDate.toDateString()
      });
    }
    
    // Current month's days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const today = new Date();
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        isSelected: selectedDate && date.toDateString() === selectedDate.toDateString()
      });
    }
    
    // Next month's days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isSelected: selectedDate && date.toDateString() === selectedDate.toDateString()
      });
    }
    
    return days;
  };

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  // Get the date range for the current week - determine year from selected date if available
  const determineYear = () => {
    if (selectedDate) {
      return selectedDate.getFullYear();
    }
    // Default to current year if no date selected
    return new Date().getFullYear();
  };

  const currentYear = determineYear();
  const weekDateRange = selectedWeek ? getWeekDateRange(selectedWeek, currentYear) : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Week Display Button */}
      <div
        onClick={toggleCalendar}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
          padding: '8px 12px',
          border: '2px solid #4CAF50',
          borderRadius: '6px',
          backgroundColor: '#E8F5E8',
          cursor: 'pointer',
          minWidth: '180px',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          color: '#2E7D32'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span>
            📅 Week {selectedWeek} {currentYear}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#2E7D32' }}>
            {showCalendar ? '▲' : '▼'}
          </span>
        </div>
        {weekDateRange && (
          <div style={{
            fontSize: '0.7rem',
            color: '#1B5E20',
            fontWeight: 'normal',
            lineHeight: '1.2'
          }}>
            {weekDateRange.formatted}
          </div>
        )}
      </div>

      {/* Calendar Dropdown */}
      {showCalendar && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            zIndex: 1000,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '320px'
          }}
        >
          {/* Month Navigation Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '16px' 
          }}>
            <button
              onClick={() => navigateMonth(-1)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              ← Previous
            </button>
            
            <div style={{ 
              fontSize: '1rem', 
              fontWeight: 'bold', 
              color: '#333' 
            }}>
              {currentMonth.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
            
            <button
              onClick={() => navigateMonth(1)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '2px',
            marginBottom: '12px'
          }}>
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                style={{
                  padding: '8px 4px',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  color: '#666',
                  backgroundColor: '#f5f5f5'
                }}
              >
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {generateCalendar().map((dayData, index) => {
              const weekNumber = getWeekNumber(dayData.date);
              return (
                <div
                  key={index}
                  onClick={() => handleDateClick(dayData.date)}
                  style={{
                    padding: '8px 4px',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    backgroundColor: dayData.isSelected 
                      ? '#4CAF50' 
                      : dayData.isToday 
                        ? '#E3F2FD' 
                        : 'transparent',
                    color: dayData.isSelected 
                      ? 'white' 
                      : dayData.isCurrentMonth 
                        ? '#333' 
                        : '#ccc',
                    borderRadius: '4px',
                    border: dayData.isToday ? '2px solid #2196F3' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!dayData.isSelected) {
                      e.target.style.backgroundColor = '#f0f0f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dayData.isSelected && !dayData.isToday) {
                      e.target.style.backgroundColor = 'transparent';
                    } else if (dayData.isToday && !dayData.isSelected) {
                      e.target.style.backgroundColor = '#E3F2FD';
                    }
                  }}
                  title={`Week ${weekNumber}`}
                >
                  {dayData.date.getDate()}
                </div>
              );
            })}
          </div>

          {/* Date Input Fallback */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '0.85rem', color: '#666' }}>
              Or enter date directly:
            </div>
            <input
              type="date"
              onChange={handleDateChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}
            />
          </div>
          
          {/* Selected Date Info */}
          {selectedDate && (
            <div
              style={{
                padding: '8px',
                backgroundColor: '#f0f7ff',
                borderRadius: '4px',
                fontSize: '0.85rem',
                textAlign: 'center',
                border: '1px solid #e3f2fd',
                marginBottom: '12px'
              }}
            >
              <div style={{ color: '#1976d2', fontWeight: '500' }}>
                Week {selectedWeek} {currentYear}
              </div>
              <div style={{ color: '#666', marginTop: '2px' }}>
                {formatDate(selectedDate)}
              </div>
            </div>
          )}
          
          <button
            onClick={() => setShowCalendar(false)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default WeekCalendar;