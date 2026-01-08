import React, { useRef, useEffect, forwardRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SeatingCanvas = forwardRef(({
  tables,
  seatingArrangement,
  maleArrangement,
  femaleArrangement,
  guests,
  scale,
  offset,
  isAddingTable,
  tableType,
  selectedTable,
  draggedGuest,
  onCanvasClick,
  onTableClick,
  onTableDrop,
  onTableUpdate,
  onOffsetChange,
  isSeparatedSeating,
  genderFilter,
  maleTables,
  femaleTables,
  canEdit = true
}, ref) => {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const lastPanPoint = useRef(null);
  const draggedTable = useRef(null);
  const dragOffset = useRef(null);
  const [hoveredTable, setHoveredTable] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState(null);
  const [dragOverTable, setDragOverTable] = useState(null);

  const getTableGender = useCallback((table) => {
    if (!isSeparatedSeating) return null;
    
    if (maleTables && maleTables.some(t => t.id === table.id)) {
      return 'male';
    }
    if (femaleTables && femaleTables.some(t => t.id === table.id)) {
      return 'female';
    }
    return null;
  }, [isSeparatedSeating, maleTables, femaleTables]);

  const CANVAS_WIDTH = 2400;  
  const CANVAS_HEIGHT = 1600; 
  
  const BOUNDARY_PADDING = 150; 
  const MIN_X = BOUNDARY_PADDING;
  const MAX_X = CANVAS_WIDTH - BOUNDARY_PADDING;
  const MIN_Y = BOUNDARY_PADDING;
  const MAX_Y = CANVAS_HEIGHT - BOUNDARY_PADDING;

  const calculateTableSize = (type, capacity) => {
    const baseSize = Math.max(80, Math.min(200, 60 + (capacity * 8)));
    
    switch (type) {
      case 'round':
        return { width: baseSize, height: baseSize };
      case 'square':
        return { width: baseSize, height: baseSize };
      case 'rectangular':
        const width = Math.max(120, baseSize * 1.4);
        const height = Math.max(60, baseSize * 0.7);
        return { width, height };
      default:
        return { width: baseSize, height: baseSize };
    }
  };

  const constrainPosition = (x, y, tableSize) => {
    const halfWidth = tableSize.width / 2;
    const halfHeight = tableSize.height / 2;
    
    return {
      x: Math.max(MIN_X + halfWidth, Math.min(MAX_X - halfWidth, x)),
      y: Math.max(MIN_Y + halfHeight, Math.min(MAX_Y - halfHeight, y))
    };
  };

  const adjustColor = (color, amount) => {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  };

  const drawChair = (ctx, x, y, isOccupied) => {
    ctx.save();
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI); 
    ctx.fill();
    
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.fillStyle = isOccupied ? '#4caf50' : '#e0e0e0';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI); 
    ctx.fill();
    
    ctx.restore();
  };

  const drawTable = useCallback((ctx, table, isSelected = false, isHovered = false) => {
    const { position, size, type, capacity, rotation = 0 } = table;
    
    const tableGender = getTableGender(table);
    
    let tableArrangement = {};
    
    if (isSeparatedSeating) {
      if (tableGender === 'male') {
        tableArrangement = maleArrangement || {};
      } else if (tableGender === 'female') {
        tableArrangement = femaleArrangement || {};
      } else {
        tableArrangement = seatingArrangement || {};
      }
    } else {
      tableArrangement = seatingArrangement || {};
    }
    
    const seatedGuests = tableArrangement[table.id] || [];
    
    const occupancy = seatedGuests.reduce((sum, guestId) => {
      const actualGuestId = guestId.replace('_male', '').replace('_female', '');
      const guest = guests.find(g => g._id === actualGuestId);
      if (!guest) return sum;
      
      if (isSeparatedSeating) {
        if (tableGender === 'male') {
          return sum + (guest.maleCount || 0);
        } else if (tableGender === 'female') {
          return sum + (guest.femaleCount || 0);
        }
      }
      
      return sum + (guest.attendingCount || 1);
    }, 0);

    const isDraggedOver = draggedGuest && dragOverTable === table.id;
    const guestSize = draggedGuest?.attendingCount || 1;
    let canAcceptGuest = draggedGuest && (occupancy + guestSize <= capacity);

    if (canAcceptGuest && isSeparatedSeating && draggedGuest && tableGender) {
      const guestGender = draggedGuest.displayGender || draggedGuest.gender;
      if (guestGender !== tableGender) {
        canAcceptGuest = false;
      }
    }

    ctx.save();
    
    ctx.translate(position.x, position.y);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    let fillColor = '#f8f9fa';
    let strokeColor = '#dee2e6';
    let strokeWidth = 2;
    
    if (tableGender === 'male') {
      fillColor = '#e3f2fd';
      strokeColor = '#90caf9';
    } else if (tableGender === 'female') {
      fillColor = '#fce4ec';
      strokeColor = '#f48fb1';
    }
    
    if (isDraggedOver) {
      if (canAcceptGuest) {
        fillColor = '#e8f5e8';
        strokeColor = '#4caf50'; 
        strokeWidth = 4;
        ctx.shadowColor = '#4caf50';
        ctx.shadowBlur = 20;
      } else {
        fillColor = '#ffebee';  
        strokeColor = '#f44336'; 
        strokeWidth = 4;
        ctx.shadowColor = '#f44336';
        ctx.shadowBlur = 20;
      }
    } else {
      if (occupancy > capacity) {
        fillColor = '#ffebee';
        strokeColor = '#e57373';
      } else if (occupancy === capacity) {
        if (tableGender === 'male') {
          fillColor = '#bbdefb';
          strokeColor = '#64b5f6';
        } else if (tableGender === 'female') {
          fillColor = '#f8bbd0';
          strokeColor = '#ec407a';
        } else {
          fillColor = '#e8f5e8';
          strokeColor = '#81c784';
        }
      } else if (occupancy > 0) {
        if (tableGender === 'male') {
          fillColor = '#e3f2fd';
          strokeColor = '#90caf9';
        } else if (tableGender === 'female') {
          fillColor = '#fce4ec';
          strokeColor = '#f48fb1';
        } else {
          fillColor = '#fff3e0';
          strokeColor = '#ffb74d';
        }
      }

      if (isSelected) {
        strokeColor = '#2196f3';
        strokeWidth = 4;
        ctx.shadowColor = '#2196f3';
        ctx.shadowBlur = 15;
      } else if (isHovered) {
        strokeColor = '#64b5f6';
        strokeWidth = 3;
        ctx.shadowColor = '#64b5f6';
        ctx.shadowBlur = 8;
      } else if (!isDraggedOver) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
    }

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(size.width, size.height) / 2);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, adjustColor(fillColor, -15));
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    if (type === 'round') {
      const radius = Math.max(size.width, size.height) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    } else if (type === 'square') {
      const sideLength = Math.min(size.width, size.height);
      const halfSide = sideLength / 2;
      ctx.fillRect(-halfSide, -halfSide, sideLength, sideLength);
      ctx.strokeRect(-halfSide, -halfSide, sideLength, sideLength);
    } else {
      const halfWidth = size.width / 2;
      const halfHeight = size.height / 2;
      ctx.fillRect(-halfWidth, -halfHeight, size.width, size.height);
      ctx.strokeRect(-halfWidth, -halfHeight, size.width, size.height);
    }

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    const textWidth = Math.max(size.width * 0.8, 80);
    const textHeight = 40;
    ctx.fillRect(-textWidth/2, -textHeight/2, textWidth, textHeight);
    
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(-textWidth/2, -textHeight/2, textWidth, textHeight);
    
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(table.name, 0, -6);
    
    ctx.font = '12px Arial';
    let occupancyText = `${occupancy}/${capacity}`;
    if (isDraggedOver && canAcceptGuest) {
      occupancyText = `${occupancy + guestSize}/${capacity}`;
    }
    
    ctx.fillStyle = isDraggedOver ? 
                  (canAcceptGuest ? '#4caf50' : '#f44336') :
                  (occupancy > capacity ? '#f44336' : 
                    occupancy === capacity ? '#ff9800' : '#666');
    ctx.fillText(occupancyText, 0, 8);

    if (isDraggedOver) {
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = canAcceptGuest ? '#4caf50' : '#f44336';
      const indicator = canAcceptGuest ? '✓' : '✗';
      ctx.fillText(indicator, size.width/2 - 15, -size.height/2 + 15);
    }

    if (type === 'round') {
      const chairDistance = Math.max(size.width, size.height) / 2 + 10;
      
      for (let i = 0; i < capacity; i++) {
        const angle = (i / capacity) * 2 * Math.PI - Math.PI / 2; 
        const chairX = Math.cos(angle) * chairDistance;
        const chairY = Math.sin(angle) * chairDistance;
        
        const previewOccupancy = isDraggedOver && canAcceptGuest ? occupancy + guestSize : occupancy;
        const isOccupied = i < previewOccupancy;
        drawChair(ctx, chairX, chairY, isOccupied);
      }
    } else {
      const chairPadding = 10;
      let chairPositions = [];
      
      if (type === 'square') {
        const chairsPerSide = Math.ceil(capacity / 4);
        
        for (let side = 0; side < 4; side++) {
          for (let i = 0; i < chairsPerSide && chairPositions.length < capacity; i++) {
            const progress = (i + 1) / (chairsPerSide + 1);
            let chairX, chairY;
            
            switch (side) {
              case 0:
                chairX = -size.width/2 + progress * size.width;
                chairY = -size.height/2 - chairPadding;
                break;
              case 1:
                chairX = size.width/2 + chairPadding;
                chairY = -size.height/2 + progress * size.height;
                break;
              case 2:
                chairX = size.width/2 - progress * size.width;
                chairY = size.height/2 + chairPadding;
                break;
              case 3:
                chairX = -size.width/2 - chairPadding;
                chairY = size.height/2 - progress * size.height;
                break;
            }
            chairPositions.push({ x: chairX, y: chairY });
          }
        }
      } else {
        const longSides = 2;
        const shortSides = 2;
        
        const chairsOnShortSides = Math.floor(capacity * 0.3);
        const chairsOnLongSides = capacity - chairsOnShortSides;
        
        const chairsPerShortSide = Math.floor(chairsOnShortSides / 2);
        const chairsPerLongSide = Math.floor(chairsOnLongSides / 2);
        
        const extraChairs = capacity - (chairsPerShortSide * 2 + chairsPerLongSide * 2);
        let extraForLong = extraChairs;
        
        const topChairs = chairsPerLongSide + Math.floor(extraForLong / 2);
        extraForLong -= Math.floor(extraForLong / 2);
        
        for (let i = 0; i < topChairs; i++) {
          const progress = (i + 1) / (topChairs + 1);
          chairPositions.push({
            x: -size.width/2 + progress * size.width,
            y: -size.height/2 - chairPadding
          });
        }
        
        for (let i = 0; i < chairsPerShortSide; i++) {
          const progress = (i + 1) / (chairsPerShortSide + 1);
          chairPositions.push({
            x: size.width/2 + chairPadding,
            y: -size.height/2 + progress * size.height
          });
        }
        
        const bottomChairs = chairsPerLongSide + extraForLong;
        for (let i = 0; i < bottomChairs; i++) {
          const progress = (i + 1) / (bottomChairs + 1);
          chairPositions.push({
            x: size.width/2 - progress * size.width,
            y: size.height/2 + chairPadding
          });
        }
        
        for (let i = 0; i < chairsPerShortSide; i++) {
          const progress = (i + 1) / (chairsPerShortSide + 1);
          chairPositions.push({
            x: -size.width/2 - chairPadding,
            y: size.height/2 - progress * size.height
          });
        }
      }
      
      chairPositions.forEach((pos, i) => {
        const previewOccupancy = isDraggedOver && canAcceptGuest ? occupancy + guestSize : occupancy;
        const isOccupied = i < previewOccupancy;
        drawChair(ctx, pos.x, pos.y, isOccupied);
      });
    }

    ctx.restore();
  }, [seatingArrangement, maleArrangement, femaleArrangement, guests, draggedGuest, dragOverTable, isSeparatedSeating, genderFilter, maleTables, femaleTables, getTableGender]);

  const drawGrid = useCallback((ctx) => {
    const gridSize = 50;
    
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(MIN_X, MIN_Y, MAX_X - MIN_X, MAX_Y - MIN_Y);
    ctx.setLineDash([]);

    ctx.fillStyle = '#2196f3';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(t('seating.canvas.tableArea'), MIN_X + 10, MIN_Y - 10);
  }, [t]);

  const getTableAtPosition = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    
    const scaleX = CANVAS_WIDTH / displayWidth;
    const scaleY = CANVAS_HEIGHT / displayHeight;
    
    const mouseX = (clientX - rect.left) * scaleX;
    const mouseY = (clientY - rect.top) * scaleY;
    
    const canvasX = (mouseX - offset.x) / scale;
    const canvasY = (mouseY - offset.y) / scale;

    for (let i = tables.length - 1; i >= 0; i--) {
      const table = tables[i];
      
      if (table.type === 'round') {
        const tableRadius = Math.max(table.size.width, table.size.height) / 2;
        const dx = canvasX - table.position.x;
        const dy = canvasY - table.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= tableRadius) {
          return table;
        }
      } else {
        let relativeX = canvasX - table.position.x;
        let relativeY = canvasY - table.position.y;
        
        if (table.rotation && table.rotation !== 0) {
          const rotationRad = (-table.rotation * Math.PI) / 180;
          const tempX = relativeX;
          relativeX = tempX * Math.cos(rotationRad) - relativeY * Math.sin(rotationRad);
          relativeY = tempX * Math.sin(rotationRad) + relativeY * Math.cos(rotationRad);
        }
        
        const halfWidth = table.size.width / 2;
        const halfHeight = table.size.height / 2;
        
        if (Math.abs(relativeX) <= halfWidth && 
            Math.abs(relativeY) <= halfHeight) {
          return table;
        }
      }
    }
    
    return null;
  }, [tables, scale, offset]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    drawGrid(ctx);

    tables.forEach(table => {
      const isSelected = selectedTable?.id === table.id;
      const isHovered = hoveredTable === table.id;
      drawTable(ctx, table, isSelected, isHovered);
    });

    if (isAddingTable && mousePosition.x && mousePosition.y) {
      const rect = canvasRef.current.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const scaleX = CANVAS_WIDTH / displayWidth;
      const scaleY = CANVAS_HEIGHT / displayHeight;
      
      const mouseX = (mousePosition.x - rect.left) * scaleX;
      const mouseY = (mousePosition.y - rect.top) * scaleY;
      const canvasX = (mouseX - offset.x) / scale;
      const canvasY = (mouseY - offset.y) / scale;
      
      const previewSize = calculateTableSize(tableType, 8);
      
      const constrainedPos = constrainPosition(canvasX, canvasY, previewSize);
      const isWithinBounds = (canvasX >= MIN_X + previewSize.width/2 && 
                             canvasX <= MAX_X - previewSize.width/2 &&
                             canvasY >= MIN_Y + previewSize.height/2 && 
                             canvasY <= MAX_Y - previewSize.height/2);
      
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = isWithinBounds ? '#4caf50' : '#f44336';
      ctx.strokeStyle = isWithinBounds ? '#388e3c' : '#d32f2f';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (tableType === 'round') {
        const radius = Math.max(previewSize.width, previewSize.height) / 2;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (tableType === 'square') {
        const sideLength = Math.min(previewSize.width, previewSize.height);
        ctx.fillRect(
          canvasX - sideLength/2, 
          canvasY - sideLength/2, 
          sideLength, 
          sideLength
        );
        ctx.strokeRect(
          canvasX - sideLength/2, 
          canvasY - sideLength/2, 
          sideLength, 
          sideLength
        );
      } else {
        ctx.fillRect(
          canvasX - previewSize.width/2, 
          canvasY - previewSize.height/2, 
          previewSize.width, 
          previewSize.height
        );
        ctx.strokeRect(
          canvasX - previewSize.width/2, 
          canvasY - previewSize.height/2, 
          previewSize.width, 
          previewSize.height
        );
      }
      
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [tables, seatingArrangement, guests, selectedTable, draggedGuest, isAddingTable, tableType, scale, offset, drawGrid, drawTable, hoveredTable, mousePosition, constrainPosition]);

  const handleCanvasClick = useCallback((event) => {
    if (!isAddingTable || !canEdit) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const scaleX = CANVAS_WIDTH / displayWidth;
    const scaleY = CANVAS_HEIGHT / displayHeight;
    
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;
    const x = (mouseX - offset.x) / scale;
    const y = (mouseY - offset.y) / scale;

    const tableSize = calculateTableSize(tableType, 8);
    const constrainedPos = constrainPosition(x, y, tableSize);

    const modifiedEvent = {
      ...event,
      constrainedPosition: constrainedPos
    };

    onCanvasClick(modifiedEvent);
  }, [isAddingTable, tableType, offset, scale, onCanvasClick, constrainPosition, calculateTableSize]);

  const handleMouseDown = useCallback((event) => {
    try {
      if (!canEdit) return;
      const table = getTableAtPosition(event.clientX, event.clientY);

      if (event.button === 2) { 
        event.preventDefault();
        if (table) {
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            table
          });
        }
        return;
      }

      if (table && !isAddingTable) {
        if (event.detail === 2) { 
          if (onTableClick) {
            onTableClick(table);
          }
          return;
        }
        
        const rect = canvasRef.current.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const scaleX = CANVAS_WIDTH / displayWidth;
        const scaleY = CANVAS_HEIGHT / displayHeight;
        
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        
        draggedTable.current = table;
        dragOffset.current = {
          x: canvasX - table.position.x,
          y: canvasY - table.position.y
        };
        event.preventDefault();
      } else if (!isAddingTable) {
        const rect = canvasRef.current.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const scaleX = CANVAS_WIDTH / displayWidth;
        const scaleY = CANVAS_HEIGHT / displayHeight;
        
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        
        isDragging.current = true;
        lastPanPoint.current = { x: mouseX, y: mouseY };
        event.preventDefault();
      }
    } catch (error) {
      draggedTable.current = null;
      dragOffset.current = null;
      isDragging.current = false;
      lastPanPoint.current = null;
    }
  }, [getTableAtPosition, isAddingTable, scale, offset, onTableClick]);

  const handleMouseMove = useCallback((event) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setMousePosition({ x: event.clientX, y: event.clientY });

    if (!draggedGuest) {
      const table = getTableAtPosition(event.clientX, event.clientY);
      const newHoveredTableId = table?.id || null;
      
      if (newHoveredTableId !== hoveredTable) {
        setHoveredTable(newHoveredTableId);
      }
    }

    if (draggedTable.current && dragOffset.current && onTableUpdate && canEdit) {
      try {
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const scaleX = CANVAS_WIDTH / displayWidth;
        const scaleY = CANVAS_HEIGHT / displayHeight;
        
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        const canvasX = (mouseX - offset.x) / scale;
        const canvasY = (mouseY - offset.y) / scale;
        
        const newX = canvasX - dragOffset.current.x;
        const newY = canvasY - dragOffset.current.y;
        
        const constrainedPos = constrainPosition(newX, newY, draggedTable.current.size);
        
        onTableUpdate(draggedTable.current.id, {
          position: constrainedPos
        });
      } catch (error) {
        draggedTable.current = null;
        dragOffset.current = null;
      }
    } else if (isDragging.current && lastPanPoint.current && onOffsetChange) {
      try {
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        const scaleX = CANVAS_WIDTH / displayWidth;
        const scaleY = CANVAS_HEIGHT / displayHeight;
        
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;
        
        const dx = mouseX - lastPanPoint.current.x;
        const dy = mouseY - lastPanPoint.current.y;
        
        onOffsetChange(prev => ({
          x: prev.x + dx,
          y: prev.y + dy
        }));
        
        lastPanPoint.current = { x: mouseX, y: mouseY };
      } catch (error) {
        isDragging.current = false;
        lastPanPoint.current = null;
      }
    }

    const canvas = canvasRef.current;
    if (canvas) {
      try {
        if (isAddingTable) {
          canvas.style.cursor = 'crosshair';
        } else if (draggedTable.current) {
          canvas.style.cursor = 'grabbing';
        } else if (!draggedGuest) {
          const table = getTableAtPosition(event.clientX, event.clientY);
          if (table) {
            canvas.style.cursor = 'grab';
          } else if (isDragging.current) {
            canvas.style.cursor = 'grabbing';
          } else {
            canvas.style.cursor = 'default';
          }
        } else {
          canvas.style.cursor = 'default';
        }
      } catch (error) {
        canvas.style.cursor = 'default';
      }
    }
  }, [canEdit, draggedTable, isDragging, lastPanPoint, scale, offset, onTableUpdate, onOffsetChange, getTableAtPosition, isAddingTable, constrainPosition, hoveredTable, draggedGuest]);

  const handleMouseUp = useCallback((event) => {
    try {
      if (isAddingTable) {
        handleCanvasClick(event);
      } else if (draggedTable.current && !isDragging.current) {
        const table = getTableAtPosition(event.clientX, event.clientY);
        if (table && table.id === draggedTable.current.id && onTableClick) {
          onTableClick(table);
        }
      }
    } catch (error) {
    } finally {
      draggedTable.current = null;
      dragOffset.current = null;
      isDragging.current = false;
      lastPanPoint.current = null;
    }
  }, [isAddingTable, handleCanvasClick, onTableClick, getTableAtPosition]);

  const handleContextMenu = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handleDragOver = useCallback((event) => {
    if (!canEdit) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    if (draggedGuest) {
      const table = getTableAtPosition(event.clientX, event.clientY);
      const newDragOverTable = table?.id || null;
      if (newDragOverTable !== dragOverTable) {
        setDragOverTable(newDragOverTable);
      }
    }
  }, [draggedGuest, getTableAtPosition, dragOverTable]);

  const handleDragEnter = useCallback((event) => {
    event.preventDefault();
    
    if (draggedGuest) {
      const table = getTableAtPosition(event.clientX, event.clientY);
      const newDragOverTable = table?.id || null;
      setDragOverTable(newDragOverTable);
    }
  }, [draggedGuest, getTableAtPosition]);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = event.clientX;
      const y = event.clientY;
      
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setDragOverTable(null);
      }
    }
  }, []);

  const handleDrop = useCallback((event) => {

    event.preventDefault();
    setContextMenu(null);
    setDragOverTable(null);

    if (!canEdit) {
      event.preventDefault();
      return;
    }
    
    if (!draggedGuest) {
      return;
    }
    
    const table = getTableAtPosition(event.clientX, event.clientY);
    
    if (!table) {
      return;
    }
    
    if (isSeparatedSeating) {
      const guestGender = draggedGuest.displayGender || draggedGuest.gender;
      
      if (!guestGender) {
        return;
      }

      const tableGender = getTableGender(table);
      
      if (tableGender && tableGender !== guestGender) {
        return;
      }
    }
    
    onTableDrop(table.id);
  }, [canEdit, getTableAtPosition, draggedGuest, onTableDrop, isSeparatedSeating, getTableGender]);


  useEffect(() => {
    if (!draggedGuest) {
      setDragOverTable(null);
    }
  }, [draggedGuest]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);
    
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('dragenter', handleDragEnter);
    canvas.addEventListener('dragleave', handleDragLeave);
    canvas.addEventListener('drop', handleDrop);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('dragenter', handleDragEnter);
      canvas.removeEventListener('dragleave', handleDragLeave);
      canvas.removeEventListener('drop', handleDrop);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu, handleDragOver, handleDragEnter, handleDragLeave, handleDrop]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (ref) {
      ref.current = canvasRef.current;
    }
  }, [ref]);

  const handleConfirmDeleteTable = useCallback(() => {
    if (tableToDelete && onTableUpdate) {
      onTableUpdate(tableToDelete.id, null);
    }
    setIsDeleteModalOpen(false);
    setTableToDelete(null);
    setContextMenu(null);
  }, [tableToDelete, onTableUpdate]);

  return (
    <div className="seating-canvas-wrapper">
      <canvas
        ref={canvasRef}
        className="seating-canvas"
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ddd',
          borderRadius: '8px',
          cursor: isAddingTable ? 'crosshair' : 'grab'
        }}
      />
      
      {isAddingTable && (
        <div className="canvas-instructions">
          {t('seating.canvas.addTableInstructions')}
        </div>
      )}

      {contextMenu && (
        <div 
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => {
            onTableClick(contextMenu.table);
            setContextMenu(null);
          }}>
            ✏️ {t('seating.contextMenu.editTable')}
          </div>
          <div className="context-menu-item" onClick={() => {
            setTableToDelete(contextMenu.table);
            setIsDeleteModalOpen(true);
            setContextMenu(null);
          }}>
            🗑️ {t('seating.contextMenu.deleteTable')}
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t('seating.table.deleteTable')}</h3>
              <button className="modal-close" onClick={() => setIsDeleteModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>{t('seating.confirmDeleteTable')}</p>
              {tableToDelete && <div className="event-to-delete">{tableToDelete.name}</div>}
            </div>
            <div className="modal-footer">
              <button className="modal-btn delete" onClick={handleConfirmDeleteTable}>
                {t('seating.tableView.deleteTable')}
              </button>
              <button className="modal-btn cancel" onClick={() => setIsDeleteModalOpen(false)}>
                {t('seating.table.cancelAddGuests')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

SeatingCanvas.displayName = 'SeatingCanvas';

export default SeatingCanvas;