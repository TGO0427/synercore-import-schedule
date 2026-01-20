import React, { useState, useRef, useCallback, useEffect } from 'react';

const ResizableModal = ({
  children,
  title,
  onClose,
  isOpen = true,
  initialWidth = 600,
  initialHeight = 'auto',
  minWidth = 300,
  minHeight = 200,
  maxWidth = '95vw',
  maxHeight = '95vh',
  showCloseButton = true,
  headerStyle = {},
  contentStyle = {},
  zIndex = 1000,
}) => {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [position, setPosition] = useState({ x: null, y: null });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const modalRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });
  const startModalPos = useRef({ x: 0, y: 0 });

  // Center modal on mount
  useEffect(() => {
    if (isOpen && position.x === null) {
      const modalWidth = typeof size.width === 'number' ? size.width : initialWidth;
      const modalHeight = typeof size.height === 'number' ? size.height : 400;
      setPosition({
        x: Math.max(0, (window.innerWidth - modalWidth) / 2),
        y: Math.max(20, (window.innerHeight - modalHeight) / 2),
      });
    }
  }, [isOpen]);

  const handleMouseDown = useCallback((e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = {
      width: modalRef.current?.offsetWidth || size.width,
      height: modalRef.current?.offsetHeight || size.height,
    };
    startModalPos.current = { x: position.x, y: position.y };
  }, [size, position]);

  const handleDragStart = useCallback((e) => {
    if (e.target.closest('.modal-resize-handle')) return;
    e.preventDefault();
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startModalPos.current = { x: position.x, y: position.y };
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (isResizing && resizeDirection) {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;
      let newX = startModalPos.current.x;
      let newY = startModalPos.current.y;

      // Handle resize directions
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minWidth, startSize.current.width + deltaX);
      }
      if (resizeDirection.includes('w')) {
        const widthChange = Math.min(deltaX, startSize.current.width - minWidth);
        newWidth = startSize.current.width - widthChange;
        newX = startModalPos.current.x + widthChange;
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minHeight, startSize.current.height + deltaY);
      }
      if (resizeDirection.includes('n')) {
        const heightChange = Math.min(deltaY, startSize.current.height - minHeight);
        newHeight = startSize.current.height - heightChange;
        newY = startModalPos.current.y + heightChange;
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    } else if (isDragging) {
      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;
      setPosition({
        x: Math.max(0, startModalPos.current.x + deltaX),
        y: Math.max(0, startModalPos.current.y + deltaY),
      });
    }
  }, [isResizing, isDragging, resizeDirection, minWidth, minHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setIsDragging(false);
    setResizeDirection(null);
  }, []);

  useEffect(() => {
    if (isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  const resizeHandleStyle = {
    position: 'absolute',
    background: 'transparent',
    zIndex: 10,
  };

  const cornerSize = 16;
  const edgeSize = 8;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex,
        overflow: 'hidden',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={modalRef}
        style={{
          position: 'absolute',
          left: position.x ?? '50%',
          top: position.y ?? '50%',
          transform: position.x === null ? 'translate(-50%, -50%)' : 'none',
          width: size.width,
          height: size.height === 'auto' ? 'auto' : size.height,
          minWidth,
          minHeight,
          maxWidth,
          maxHeight,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          cursor: isResizing ? (
            resizeDirection?.includes('n') && resizeDirection?.includes('w') ? 'nwse-resize' :
            resizeDirection?.includes('n') && resizeDirection?.includes('e') ? 'nesw-resize' :
            resizeDirection?.includes('s') && resizeDirection?.includes('w') ? 'nesw-resize' :
            resizeDirection?.includes('s') && resizeDirection?.includes('e') ? 'nwse-resize' :
            resizeDirection?.includes('n') || resizeDirection?.includes('s') ? 'ns-resize' :
            'ew-resize'
          ) : 'default',
        }}
      >
        {/* Header - draggable */}
        <div
          onMouseDown={handleDragStart}
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            backgroundColor: '#f9fafb',
            borderRadius: '12px 12px 0 0',
            ...headerStyle,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
            {title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500' }}>
              Drag to move • Edges to resize
            </span>
            {showCloseButton && (
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => e.target.style.color = '#1f2937'}
                onMouseLeave={(e) => e.target.style.color = '#6b7280'}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '1.5rem',
            ...contentStyle,
          }}
        >
          {children}
        </div>

        {/* Resize handles */}
        {/* Corners */}
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'nw')}
          style={{ ...resizeHandleStyle, top: 0, left: 0, width: cornerSize, height: cornerSize, cursor: 'nwse-resize' }}
        />
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'ne')}
          style={{ ...resizeHandleStyle, top: 0, right: 0, width: cornerSize, height: cornerSize, cursor: 'nesw-resize' }}
        />
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'sw')}
          style={{ ...resizeHandleStyle, bottom: 0, left: 0, width: cornerSize, height: cornerSize, cursor: 'nesw-resize' }}
        />
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'se')}
          style={{ ...resizeHandleStyle, bottom: 0, right: 0, width: cornerSize, height: cornerSize, cursor: 'nwse-resize' }}
        />

        {/* Edges */}
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'n')}
          style={{ ...resizeHandleStyle, top: 0, left: cornerSize, right: cornerSize, height: edgeSize, cursor: 'ns-resize' }}
        />
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 's')}
          style={{ ...resizeHandleStyle, bottom: 0, left: cornerSize, right: cornerSize, height: edgeSize, cursor: 'ns-resize' }}
        />
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'w')}
          style={{ ...resizeHandleStyle, left: 0, top: cornerSize, bottom: cornerSize, width: edgeSize, cursor: 'ew-resize' }}
        />
        <div
          className="modal-resize-handle"
          onMouseDown={(e) => handleMouseDown(e, 'e')}
          style={{ ...resizeHandleStyle, right: 0, top: cornerSize, bottom: cornerSize, width: edgeSize, cursor: 'ew-resize' }}
        />
      </div>
    </div>
  );
};

export default ResizableModal;
