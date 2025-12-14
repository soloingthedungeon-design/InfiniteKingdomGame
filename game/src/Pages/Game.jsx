'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sword, Shield, Heart, Zap, Coins, Home, Moon, ShoppingBag, LogOut, Footprints, Skull, Map, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  buildGameContentForPlayer, 
  pickOverworldTileId, 
  pickCaveTileId, 
  pickMonsterForTile, 
  pickGroundLootForTile, 
  pickShopItemId, 
  pickQuestId,
  getTileById,
  getItemById
} from '../components/contentSystem';
import { POWERGATES } from '../components/powergateData';

// Item classification
const getItemCategory = (item) => {
  if (!item) return null;
  if (item.type === 'consumable') return 'consumable';
  if (item.type !== 'gear') return null;
  
  if (item.slot === 'weapon') return 'weapon';
  if (item.slot === 'armor') return 'armor';
  if (item.slot === 'boots') return 'boots';
  
  return 'magic';
};

// Helper functions for distance-based powergate selection
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const pickGateByDistance = (tileX, tileY, maxUnlockedGate) => {
  const dist = Math.abs(tileX) + Math.abs(tileY);

  if (dist <= 1) return 0;

  const bandGate = clamp(Math.floor(dist / 2), 0, maxUnlockedGate);

  if (bandGate > 0 && Math.random() < 0.30) return bandGate - 1;
  return bandGate;
};

// Immutable tile update helpers
const updateOverworldCell = (tiles, tileKey, cellX, cellY, patch) => {
  const tile = tiles[tileKey];
  if (!tile) return tiles;
  return {
    ...tiles,
    [tileKey]: {
      ...tile,
      cells: tile.cells.map(c => 
        c.x === cellX && c.y === cellY ? { ...c, ...patch } : c
      )
    }
  };
};

const updateCaveCell = (caveTile, cellX, cellY, patch) => {
  if (!caveTile) return caveTile;
  return {
    ...caveTile,
    cells: caveTile.cells.map(c => 
      c.x === cellX && c.y === cellY ? { ...c, ...patch } : c
    )
  };
};

// Get tile render data from content system
const getTileRenderData = (tileId, gameContent, isTownTile = false, isTentTile = false) => {
  // Town tiles use plains (grass) appearance
  if (isTownTile) {
    const plainsTile = getTileById(gameContent, 'plains');
    return { 
      bg: plainsTile?.bg || '#88cc88', 
      border: plainsTile?.border || '#6aaa6a', 
      name: 'Town', 
      walkable: true, 
      bgImage: plainsTile?.bgImage || null, 
      encounterChance: 0 
    };
  }
  
  // Tent tiles - simple floor
  if (isTentTile || tileId === 'tent_floor') {
    return {
      bg: '#8b7355',
      border: '#6b5335',
      name: 'Tent Floor',
      walkable: true,
      bgImage: null,
      encounterChance: 0
    };
  }
  
  const tile = getTileById(gameContent, tileId);
  if (!tile) return { bg: '#555555', border: '#3a3a3a', name: 'Unknown', walkable: false, bgImage: null, encounterChance: 0 };
  
  return {
    bg: tile.bg,
    border: tile.border,
    name: tile.name,
    walkable: tile.walkable,
    bgImage: tile.bgImage || null,
    encounterChance: tile.encounterChance || 0
  };
};



// Local storage helpers
const SAVE_KEY = 'fogbound_save';

const saveGame = (gameState) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
};

const loadGame = () => {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
};

const clearSave = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('Failed to clear save:', e);
  }
};

const generateTile = (tileX, tileY, expeditionId, gameContent, entryCellX = null, entryCellY = null) => {
  const cells = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      // Use content system to pick tile
      const tileId = pickOverworldTileId(gameContent);
      
      // Rarely spawn treasure (8% chance on walkable terrain)
      const tile = getTileById(gameContent, tileId);
      const hasTreasure = tile.walkable && Math.random() < 0.04;
      
      cells.push({ x, y, tileId, hasTreasure });
    }
  }
  
  // Ensure entry cell is walkable
  if (entryCellX !== null && entryCellY !== null) {
    const entryCell = cells.find(c => c.x === entryCellX && c.y === entryCellY);
    if (entryCell) {
      const tile = getTileById(gameContent, entryCell.tileId);
      if (!tile.walkable) {
        entryCell.tileId = 'plains'; // Force walkable
      }
    }
  }
  
  // 10% chance to spawn a cave entrance (only one per tile)
  if (Math.random() < 0.10) {
    const eligibleCells = cells.filter(c => {
      const tile = getTileById(gameContent, c.tileId);
      return tile.walkable && !c.hasTreasure;
    });
    if (eligibleCells.length > 0) {
      const randomCell = eligibleCells[Math.floor(Math.random() * eligibleCells.length)];
      randomCell.hasCaveEntrance = true;
    }
  }
  
  return { tileX, tileY, cells, expeditionId, isTown: false };
};

// Blob growth helper for hazard clustering
const growBlob = (cells, startX, startY, targetTileId, steps) => {
  const toGrow = [{ x: startX, y: startY }];
  const grown = new Set([`${startX},${startY}`]);
  
  for (let i = 0; i < steps; i++) {
    if (toGrow.length === 0) break;
    const current = toGrow.shift();
    
    // Mark current cell
    const cell = cells.find(c => c.x === current.x && c.y === current.y);
    if (cell && cell.tileId === 'cave_stone') {
      cell.tileId = targetTileId;
    }
    
    // Grow to neighbors
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];
    
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= 6 || n.y < 0 || n.y >= 6) continue;
      const key = `${n.x},${n.y}`;
      if (grown.has(key)) continue;
      if (Math.random() < 0.6) {
        toGrow.push(n);
        grown.add(key);
      }
    }
  }
};

const generateCaveTile = (gameContent) => {
  const cells = [];
  
  // Fill with cave stone base
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      cells.push({ x, y, tileId: 'cave_stone', hasTreasure: false });
    }
  }
  
  // Spawn chasm blobs (10-12% coverage)
  const chasmSeeds = Math.floor(Math.random() * 2) + 2; // 2-3 seeds
  for (let i = 0; i < chasmSeeds; i++) {
    const seedX = Math.floor(Math.random() * 6);
    const seedY = Math.floor(Math.random() * 6);
    growBlob(cells, seedX, seedY, 'cave_chasm', 3);
  }
  
  // Spawn lava blobs (5-7% coverage, rarer)
  const lavaSeeds = Math.floor(Math.random() * 2) + 1; // 1-2 seeds
  for (let i = 0; i < lavaSeeds; i++) {
    const seedX = Math.floor(Math.random() * 6);
    const seedY = Math.floor(Math.random() * 6);
    growBlob(cells, seedX, seedY, 'cave_lava', 2);
  }
  
  // Place stairway out at position (2, 2) - always walkable
  const stairCell = cells.find(c => c.x === 2 && c.y === 2);
  if (stairCell) {
    stairCell.tileId = 'cave_stone';
    stairCell.hasTreasure = false;
    stairCell.hasStairway = true;
  }
  
  // Spawn treasure on walkable tiles (20% chance)
  for (const cell of cells) {
    const tile = getTileById(gameContent, cell.tileId);
    if (tile.walkable && !cell.hasStairway && Math.random() < 0.08) {
      cell.hasTreasure = true;
    }
  }
  
  return { tileX: 0, tileY: 0, cells, isCave: true };
};

const generateTentTile = () => {
  const cells = [];
  
  // Fixed 3x4 tent interior
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 3; x++) {
      const cell = { x, y, tileId: 'tent_floor' };
      
      // Exit at (1, 3)
      if (x === 1 && y === 3) {
        cell.isTentExit = true;
      }
      // Bed at (2, 1)
      if (x === 2 && y === 1) {
        cell.isTentBed = true;
      }
      // Mailbox at (0, 1)
      if (x === 0 && y === 1) {
        cell.isTentMailbox = true;
      }
      
      cells.push(cell);
    }
  }
  
  return { tileX: 0, tileY: 0, cells, isTent: true };
};

const generateTownTile = () => {
  const cells = [];
  const townSize = 6;
  
  for (let y = 0; y < townSize; y++) {
    for (let x = 0; x < townSize; x++) {
      let building = null;

      // Inn at position (1, 0) - 2x2 building
      if ((x === 1 || x === 2) && (y === 0 || y === 1)) building = 'inn';
      // Bank at position (4, 0) - 2x2 building
      if ((x === 4 || x === 5) && (y === 0 || y === 1)) building = 'bank';
      // Shop at position (1, 3) - 2x2 building
      if ((x === 1 || x === 2) && (y === 3 || y === 4)) building = 'shop';
      // Vault at position (4, 3) - 2x2 building
      if ((x === 4 || x === 5) && (y === 3 || y === 4)) building = 'vault';
      // Fairy NPC at position (3, 0)
      if (x === 3 && y === 0) building = 'fairy';
      
      cells.push({ 
        x, y, 
        tileId: 'plains',
        building
      });
    }
  }
  return { tileX: 0, tileY: 0, cells, expeditionId: 0, isTown: true };
};



export default function Game() {
  // Initialize state from save or defaults
  const [initialized, setInitialized] = useState(false);
  
  // Game state
  const [player, setPlayer] = useState({
    basePow: 3,
    baseSpd: 3,
    baseMaxHp: 20,
    hp: 20,
    gold: 0,
    bankGold: 0,
    tileX: 0,
    tileY: 0,
    cellX: 2,
    cellY: 2,
    facing: 'south',
    equipment: {
      weapon: null,
      armor: null,
      boots: null,
      magic: null
    },
    backpack: [],
    backpackCap: 8,
    vaultItems: [],
    unlocks: {}
  });

  const [backpackOpen, setBackpackOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [dropModal, setDropModal] = useState({ isOpen: false, pendingItem: null, reason: '' });
  const [viewportWidth] = useState(6);
  const [viewportHeight] = useState(4);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [isLandscape, setIsLandscape] = useState(window.matchMedia('(orientation: landscape)').matches);
  const [isMoving, setIsMoving] = useState(false);
  const movingRef = React.useRef(false);
  const moveTimerRef = React.useRef(null);
  const lastMoveIdRef = React.useRef(0);
  const gridRef = React.useRef(null);
  const [cellSizeState, setCellSizeState] = useState(0);
  
  const [overworldTiles, setOverworldTiles] = useState(() => {
    const townTile = generateTownTile();
    return { '0,0': townTile };
  });
  
  const [caveTile, setCaveTile] = useState(null);
  const [tentTile, setTentTile] = useState(null);
  
  const [expeditionId, setExpeditionId] = useState(1);
  const [inCave, setInCave] = useState(false);
  const [inTent, setInTent] = useState(false);
  const [caveReturnPosition, setCaveReturnPosition] = useState(null);
  const [tentReturnPosition, setTentReturnPosition] = useState(null);
  const [tentUsedThisTrip, setTentUsedThisTrip] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'inn', 'bank', 'shop', 'fairy', or null
  const [activeQuest, setActiveQuest] = useState(null);
  const [currentPowergate, setCurrentPowergate] = useState(0);
  const [completedQuestsByGate, setCompletedQuestsByGate] = useState({});
  const [questPanelOpen, setQuestPanelOpen] = useState(false);
  const [shopItems, setShopItems] = useState(() => {
    const initPlayer = { basePow: 3, baseSpd: 3, baseMaxHp: 20, equipment: {} };
    const gameContent = buildGameContentForPlayer(initPlayer, 0);
    return [
      getItemById(gameContent, pickShopItemId(gameContent)),
      getItemById(gameContent, pickShopItemId(gameContent)),
      getItemById(gameContent, pickShopItemId(gameContent)),
      getItemById(gameContent, pickShopItemId(gameContent))
    ].filter(Boolean);
  });
  
  // Combat state
  const [combat, setCombat] = useState(null);
  const [combatLog, setCombatLog] = useState([]);
  const [combatMessage, setCombatMessage] = useState('');
  const [lastRolls, setLastRolls] = useState(null);
  const [combatActionInProgress, setCombatActionInProgress] = useState(false);
  
  // Game over state
  const [gameOver, setGameOver] = useState(false);
  const [stats, setStats] = useState({ monstersKilled: 0, goldEarned: 0, tilesExplored: 0 });
  
  // Message system
  const [message, setMessage] = useState(null);
  const [messageQueue, setMessageQueue] = useState([]);
  
  // Use correct tile source based on cave/tent state
  const tiles = inCave ? (caveTile ? { '0,0': caveTile } : {}) : 
                inTent ? (tentTile ? { '0,0': tentTile } : {}) : 
                overworldTiles;
  const currentTileKey = `${player.tileX},${player.tileY}`;
  const currentTile = tiles[currentTileKey];
  
  // Build game content once per render (using currentPowergate, not player stats)
  const gameContent = useMemo(() => buildGameContentForPlayer(player, currentPowergate), [currentPowergate]);
  
  // Build per-gate content for distance-based tile generation
  const gameContentByGate = useMemo(() => {
    const arr = [];
    for (let g = 0; g <= currentPowergate; g++) {
      arr[g] = buildGameContentForPlayer(player, g);
    }
    return arr;
  }, [player, currentPowergate]);
  
  const currentCell = useMemo(() => {
    if (!currentTile) return null;
    return currentTile.cells.find(c => c.x === player.cellX && c.y === player.cellY);
  }, [currentTile, player.cellX, player.cellY]);
  
  // Derived stats (prevents stat drift bugs)
  const derivedStats = useMemo(() => {
    const eq = player.equipment;
    
    const pow = player.basePow
      + (eq.weapon?.powMod || 0)
      + (eq.magic?.powMod || 0)
      + (eq.armor?.powMod || 0)
      + (eq.boots?.powMod || 0);
    
    const spd = player.baseSpd
      + (eq.boots?.spdMod || 0)
      + (eq.magic?.spdMod || 0)
      + (eq.weapon?.spdMod || 0)
      + (eq.armor?.spdMod || 0);
    
    const maxHp = player.baseMaxHp
      + (eq.armor?.maxHpMod || 0)
      + (eq.magic?.maxHpMod || 0)
      + (eq.weapon?.maxHpMod || 0)
      + (eq.boots?.maxHpMod || 0);
    
    return { pow, spd, maxHp };
  }, [player.basePow, player.baseSpd, player.baseMaxHp, player.equipment]);
  
  // Clamp HP when maxHp changes
  useEffect(() => {
    setPlayer(p => ({ ...p, hp: Math.min(p.hp, derivedStats.maxHp) }));
  }, [derivedStats.maxHp]);
  
  const currentBuilding = currentTile?.isTown ? currentCell?.building : null;
  const onCaveEntrance = !inCave && !inTent && currentCell?.hasCaveEntrance;
  const onStairway = inCave && currentCell?.hasStairway;
  const onTentExit = inTent && currentCell?.isTentExit;
  const onTentBed = inTent && currentCell?.isTentBed;
  const onTentMailbox = inTent && currentCell?.isTentMailbox;
  
  // Message system
  const showMessage = useCallback((text, type = 'info') => {
    setMessageQueue(prev => [...prev, { text, type, id: Date.now() + Math.random() }]);
  }, []);
  
  // Process message queue
  useEffect(() => {
    if (messageQueue.length > 0 && !message) {
      const nextMessage = messageQueue[0];
      setMessage(nextMessage);
      setMessageQueue(prev => prev.slice(1));
      
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [messageQueue, message]);
  
  const dismissMessage = useCallback(() => {
    setMessage(null);
  }, []);
  
  // Release movement lock with cleanup
  const releaseMoveLock = useCallback(() => {
    movingRef.current = false;
    setIsMoving(false);
    if (moveTimerRef.current) {
      clearTimeout(moveTimerRef.current);
      moveTimerRef.current = null;
    }
  }, []);
  
  // Safety net: unlock when player position changes
  useEffect(() => {
    releaseMoveLock();
  }, [player.tileX, player.tileY, player.cellX, player.cellY, releaseMoveLock]);
  
  // Load game on mount
  useEffect(() => {
    if (initialized) return;
    
    const savedGame = loadGame();
    if (savedGame) {
      // Migrate old save format
      let migratedPlayer = savedGame.player;
      if (savedGame.player.gear || savedGame.player.inventory || savedGame.player.vaultGear) {
        const oldGear = savedGame.player.gear || [];
        const oldInventory = savedGame.player.inventory || [];
        const oldVault = savedGame.player.vaultGear || savedGame.player.vaultItems || [];

        const equipment = {
          weapon: oldGear.find(g => g.slot === 'weapon') || null,
          armor: oldGear.find(g => g.slot === 'armor') || null,
          boots: oldGear.find(g => g.slot === 'boots') || null,
          magic: oldGear.find(g => g.slot && !['weapon','armor','boots'].includes(g.slot)) || null
        };

        const backpack = [...oldGear.filter(g => !Object.values(equipment).includes(g)), ...oldInventory].slice(0, 8);
        const vaultItems = oldVault.slice(0, 8);

        migratedPlayer = {
          ...savedGame.player,
          equipment,
          backpack,
          backpackCap: 8,
          vaultItems
        };
        delete migratedPlayer.gear;
        delete migratedPlayer.inventory;
        delete migratedPlayer.weapons;
        delete migratedPlayer.vaultGear;
      }

      // Ensure unlocks exists
      if (!migratedPlayer.unlocks) {
        migratedPlayer.unlocks = {};
      }
      
      setPlayer(migratedPlayer);
      setOverworldTiles(savedGame.overworldTiles);
      setExpeditionId(savedGame.expeditionId);
      setActiveQuest(savedGame.activeQuest);
      setCurrentPowergate(savedGame.currentPowergate || 0);
      setCompletedQuestsByGate(savedGame.completedQuestsByGate || {});
      setStats(savedGame.stats);
      setTentUsedThisTrip(savedGame.tentUsedThisTrip || false);
      setTentReturnPosition(savedGame.tentReturnPosition || null);
      
      // Restore tent state if saved in tent
      if (savedGame.inTent) {
        setInTent(true);
        setTentTile(savedGame.tentTile || generateTentTile());
      }

      const loadedPowergate = savedGame.currentPowergate || 0;
      const gameContent = buildGameContentForPlayer(migratedPlayer, loadedPowergate);
      setShopItems(savedGame.shopItems || [
        getItemById(gameContent, pickShopItemId(gameContent)),
        getItemById(gameContent, pickShopItemId(gameContent)),
        getItemById(gameContent, pickShopItemId(gameContent)),
        getItemById(gameContent, pickShopItemId(gameContent))
      ].filter(Boolean));
    }
    setInitialized(true);
  }, [initialized]);
  
  // Auto-save game state
  useEffect(() => {
    if (!initialized || gameOver) return;
    
    const gameState = {
      player,
      overworldTiles,
      expeditionId,
      activeQuest,
      currentPowergate,
      completedQuestsByGate,
      stats,
      shopItems,
      tentUsedThisTrip,
      tentReturnPosition,
      inTent,
      tentTile,
      timestamp: Date.now()
    };
    
    saveGame(gameState);
  }, [player, overworldTiles, expeditionId, activeQuest, stats, shopItems, initialized, gameOver]);
  
  // Quest progress tracking
  const updateQuestProgress = useCallback((objectiveType, zone = null, amount = 1) => {
    if (!activeQuest) return;
    if (activeQuest.completed) return;
    
    const objective = activeQuest.objective;
    if (!objective) return;
    
    // Check if this event matches the quest objective
    let matches = false;
    if (objective.type === objectiveType) {
      if (objective.zone) {
        matches = objective.zone === zone;
      } else {
        matches = true;
      }
    }
    
    // Handle TRAVEL_DISTANCE as alias for TILES_REVEALED
    if (objective.type === 'TRAVEL_DISTANCE' && objectiveType === 'TILES_REVEALED') {
      matches = true;
    }
    
    if (!matches) return;
    
    setActiveQuest(prev => {
      if (!prev || !prev.objective || prev.completed) return prev;
      const newProgress = (prev.progress || 0) + amount;
      
      if (newProgress >= prev.objective.count) {
        showMessage(`✨ Quest Complete! Return to ${POWERGATES[currentPowergate]?.questGiver?.npcName || 'the quest giver'} to claim your reward!`, 'success');
        return { ...prev, progress: prev.objective.count, completed: true };
      }
      
      return { ...prev, progress: newProgress };
    });
  }, [activeQuest, currentPowergate, showMessage]);
  
  // Move player (continuous movement, no turn system)
  const movePlayer = useCallback((dx, dy) => {
    // Don't allow movement during combat, modal, or while animating
    if (combat || activeModal || movingRef.current) return;
    
    // If in tent, restrict movement to 3x4 grid
    if (inTent) {
      let newCellX = player.cellX + dx;
      let newCellY = player.cellY + dy;
      
      // Boundary check for tent (3 wide, 4 tall)
      if (newCellX < 0 || newCellX >= 3 || newCellY < 0 || newCellY >= 4) return;
      
      const targetCell = currentTile.cells.find(c => c.x === newCellX && c.y === newCellY);
      
      // Determine facing direction
      let facing = player.facing;
      if (dy < 0) facing = 'north';
      else if (dy > 0) facing = 'south';
      else if (dx < 0) facing = 'west';
      else if (dx > 0) facing = 'east';

      // Lock movement
      movingRef.current = true;
      setIsMoving(true);
      const moveId = ++lastMoveIdRef.current;
      
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        if (lastMoveIdRef.current === moveId) {
          releaseMoveLock();
        }
      }, 250);
      
      setPlayer(prev => ({ ...prev, cellX: newCellX, cellY: newCellY, facing }));
      return;
    }
    
    // If in cave, restrict movement to single tile
    if (inCave) {
      let newCellX = player.cellX + dx;
      let newCellY = player.cellY + dy;
      
      // Boundary check for cave
      if (newCellX < 0 || newCellX >= 6 || newCellY < 0 || newCellY >= 6) return;
      
      const targetCell = currentTile.cells.find(c => c.x === newCellX && c.y === newCellY);
      
      // In caves, check walkability
      const targetTileData = getTileById(gameContent, targetCell.tileId);
      if (!targetTileData?.walkable) {
        return;
      }
      
      // Check for treasure
      if (targetCell.hasTreasure) {
        const treasure = pickGroundLootForTile(gameContent, targetCell.tileId);

        // Immutably mark treasure as collected
        setCaveTile(prev => updateCaveCell(prev, targetCell.x, targetCell.y, { hasTreasure: false }));

        setPlayer(prev => {
          const newCellX = player.cellX + dx;
          const newCellY = player.cellY + dy;

          if (treasure.type === 'gold') {
            // Track quest progress for cave treasure
            updateQuestProgress('LOOT_COUNT', 'CAVE', 1);

            showMessage(`💎 You pry loose a pouch of ${treasure.amount} gold from the stone.`, 'success');
            return { ...prev, cellX: newCellX, cellY: newCellY, gold: prev.gold + treasure.amount };
          } else if (treasure.type === 'item' && treasure.item) {
            // Check backpack space (consumables only)
            if (treasure.item.type === 'consumable') {
              if (prev.backpack.length >= prev.backpackCap) {
                updateQuestProgress('LOOT_COUNT', 'CAVE', 1);
                showMessage(`📦 Found ${treasure.item.name} but your pack is full. Item lost.`, 'warning');
                return { ...prev, cellX: newCellX, cellY: newCellY };
              } else {
                updateQuestProgress('LOOT_COUNT', 'CAVE', 1);
                const messages = {
                  'healing-herb': `🌿 You discover a Healing Herb growing in the damp darkness.`,
                  'health-potion': `🧪 You find a sealed Health Potion hidden in the shadows.`,
                  'rune-stone': `🗿 You uncover an ancient Rune Stone etched with fading glyphs.`
                };
                showMessage(messages[treasure.item.id] || `✨ You found a ${treasure.item.name}!`, 'success');
                return { ...prev, cellX: newCellX, cellY: newCellY, backpack: [...prev.backpack, treasure.item] };
              }
            } else {
              // Gear found as treasure but backpack full - item is lost
              updateQuestProgress('LOOT_COUNT', 'CAVE', 1);
              showMessage(`📦 Found ${treasure.item.name} but your pack is full. Item lost.`, 'warning');
              return { ...prev, cellX: newCellX, cellY: newCellY };
            }
          }

          return { ...prev, cellX: newCellX, cellY: newCellY };
        });

        return;
      }
      
      // Determine facing direction
      let facing = player.facing;
      if (dy < 0) facing = 'north';
      else if (dy > 0) facing = 'south';
      else if (dx < 0) facing = 'west';
      else if (dx > 0) facing = 'east';

      // Lock movement with watchdog timer
      movingRef.current = true;
      setIsMoving(true);
      const moveId = ++lastMoveIdRef.current;
      
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        if (lastMoveIdRef.current === moveId) {
          releaseMoveLock();
        }
      }, 250);
      
      setPlayer(prev => ({ ...prev, cellX: newCellX, cellY: newCellY, facing }));
      
      // Check for encounters (use targetTileData that was already fetched)
      if (Math.random() < (targetTileData?.encounterChance || 0)) {
        const monster = pickMonsterForTile(gameContent, targetCell.tileId);
        if (monster) {
          setCombat(monster);
          setCombatMessage(`⚔️ From the darkness, a ${monster.name} appears!`);
          setCombatLog([`⚔️ Encountered a ${monster.name}!`]);
        }
      }
      
      return;
    }
    
    // Check for skipNextMove
    if (player.skipNextMove) {
      setPlayer(prev => ({ ...prev, skipNextMove: false }));
      showMessage('😵 You are still reeling from the Harpy\'s scream!', 'warning');
      return;
    }
    
    let newCellX = player.cellX + dx;
    let newCellY = player.cellY + dy;
    let newTileX = player.tileX;
    let newTileY = player.tileY;
    
    // Handle tile transitions
    const gridSize = 6;
    if (newCellX < 0) { newTileX--; newCellX = gridSize - 1; }
    if (newCellX >= gridSize) { newTileX++; newCellX = 0; }
    if (newCellY < 0) { newTileY--; newCellY = gridSize - 1; }
    if (newCellY >= gridSize) { newTileY++; newCellY = 0; }
    
    const targetTileKey = `${newTileX},${newTileY}`;
    let targetTile = overworldTiles[targetTileKey];

    // Check if entering town from outside - collapse the world
    if (newTileX === 0 && newTileY === 0 && (player.tileX !== 0 || player.tileY !== 0)) {
      const townTile = generateTownTile();
      setOverworldTiles({ '0,0': townTile });
      setExpeditionId(prev => prev + 1);
      setTentUsedThisTrip(false); // Reset tent usage on return to town
      targetTile = townTile;
    } else if (!targetTile) {
      // Generate new tile if needed
      if (newTileX === 0 && newTileY === 0) {
        const townTile = generateTownTile();
        setOverworldTiles({ '0,0': townTile });
        setExpeditionId(prev => prev + 1);
        targetTile = townTile;
      } else {
        // Distance-based powergate selection
        const localGate = pickGateByDistance(newTileX, newTileY, currentPowergate);
        const localContent = gameContentByGate[localGate] || gameContent;

        targetTile = generateTile(
          newTileX,
          newTileY,
          expeditionId,
          localContent,
          newCellX,
          newCellY
        );

        targetTile.tilePowergate = localGate;

        setOverworldTiles(prev => ({ ...prev, [targetTileKey]: targetTile }));
        setStats(prev => ({ ...prev, tilesExplored: prev.tilesExplored + 1 }));
        updateQuestProgress('TILES_REVEALED', null, 1);
      }
      }
    
    const targetCell = targetTile.cells.find(c => c.x === newCellX && c.y === newCellY);
    
    // Check if blocked (town is always walkable)
    if (!targetTile.isTown) {
      const targetTileData = getTileById(gameContent, targetCell.tileId);
      if (!targetTileData?.walkable) {
        return;
      }
    }

    // Check for treasure
    if (targetCell.hasTreasure) {
      // Use the same content tier as the tile itself
      const tileContent = targetTile.tilePowergate !== undefined ? (gameContentByGate[targetTile.tilePowergate] || gameContent) : gameContent;
      const treasure = pickGroundLootForTile(tileContent, targetCell.tileId);

      // Immutably mark treasure as collected
      setOverworldTiles(prev => updateOverworldCell(prev, targetTileKey, targetCell.x, targetCell.y, { hasTreasure: false }));
      
      setPlayer(prev => {
        if (treasure.type === 'gold') {
          updateQuestProgress('LOOT_COUNT', 'OVERWORLD', 1);
          showMessage(`💰 You discover a small cache of ${treasure.amount} gold beneath the moss.`, 'success');
          return {
            ...prev,
            cellX: newCellX,
            cellY: newCellY,
            tileX: newTileX,
            tileY: newTileY,
            gold: prev.gold + treasure.amount
          };
        } else if (treasure.type === 'item' && treasure.item) {
          if (treasure.item.type === 'consumable') {
            if (prev.backpack.length >= prev.backpackCap) {
              updateQuestProgress('LOOT_COUNT', 'OVERWORLD', 1);
              showMessage(`📦 Found ${treasure.item.name} but your pack is full. Item lost.`, 'warning');
              return {
                ...prev,
                cellX: newCellX,
                cellY: newCellY,
                tileX: newTileX,
                tileY: newTileY
              };
            } else {
              const messages = {
                'healing-herb': `🌿 You discover a Healing Herb tucked beneath the roots.`,
                'health-potion': `🧪 You find a sealed Health Potion wrapped in cloth.`,
                'rune-stone': `🗿 You uncover a weathered Rune Stone half-buried in the earth.`
              };
              updateQuestProgress('LOOT_COUNT', 'OVERWORLD', 1);
              showMessage(messages[treasure.item.id] || `✨ You found a ${treasure.item.name}!`, 'success');
              return {
                ...prev,
                cellX: newCellX,
                cellY: newCellY,
                tileX: newTileX,
                tileY: newTileY,
                backpack: [...prev.backpack, treasure.item]
              };
            }
          } else {
            // Gear found but backpack full - item is lost
            updateQuestProgress('LOOT_COUNT', 'OVERWORLD', 1);
            showMessage(`📦 Found ${treasure.item.name} but your pack is full. Item lost.`, 'warning');
            return {
              ...prev,
              cellX: newCellX,
              cellY: newCellY,
              tileX: newTileX,
              tileY: newTileY
            };
          }
        }
        
        return {
          ...prev,
          cellX: newCellX,
          cellY: newCellY,
          tileX: newTileX,
          tileY: newTileY
        };
      });
      
      return;
    }

    // Determine facing direction
    let facing = player.facing;
    if (dy < 0) facing = 'north';
    else if (dy > 0) facing = 'south';
    else if (dx < 0) facing = 'west';
    else if (dx > 0) facing = 'east';

    // Lock movement with watchdog timer
    movingRef.current = true;
    setIsMoving(true);
    const moveId = ++lastMoveIdRef.current;
    
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    moveTimerRef.current = setTimeout(() => {
      if (lastMoveIdRef.current === moveId) {
        releaseMoveLock();
      }
    }, 250);
    
    setPlayer(prev => ({
      ...prev,
      cellX: newCellX,
      cellY: newCellY,
      tileX: newTileX,
      tileY: newTileY,
      facing
    }));
    
    // Check for random encounter (not in town)
    if (!targetTile.isTown) {
      const targetTileData = getTileById(gameContent, targetCell.tileId);
      const encounterChance = targetTileData?.encounterChance || 0;

      if (Math.random() < encounterChance) {
        const monster = pickMonsterForTile(gameContent, targetCell.tileId);

        if (monster) {
          setCombat(monster);

          const terrainMsg = targetCell.tileId === 'swamp' 
            ? `💀 The swamp stirs… A ${monster.name} appears!`
            : `⚔️ Something emerges from the fog! A ${monster.name} appears!`;

          setCombatMessage(terrainMsg);
          setCombatLog([`⚔️ Encountered a ${monster.name}!`]);
        }
      }
    }
  }, [combat, activeModal, player, overworldTiles, expeditionId, inCave, inTent, showMessage, updateQuestProgress, gameContent, currentTile, releaseMoveLock, gameContentByGate, currentPowergate]);
  
  // Enter cave - PRESERVE overworld tiles
  const enterCave = useCallback(() => {
    setCaveReturnPosition({ 
      zone: 'OVERWORLD',
      tileX: player.tileX, 
      tileY: player.tileY, 
      cellX: player.cellX, 
      cellY: player.cellY 
    });
    const newCaveTile = generateCaveTile(gameContent);
    setCaveTile(newCaveTile);
    setPlayer(prev => ({ ...prev, tileX: 0, tileY: 0, cellX: 2, cellY: 2 }));
    setInCave(true);
    updateQuestProgress('ENTER_ZONE', 'CAVE', 1);
    showMessage('🕳️ You descend into the cave...', 'info');
  }, [player.tileX, player.tileY, player.cellX, player.cellY, gameContent, showMessage, updateQuestProgress]);
  
  // Exit cave - RESTORE preserved overworld
  const exitCave = useCallback(() => {
    if (!caveReturnPosition || caveReturnPosition.zone !== 'OVERWORLD') {
      // Fallback to town if anchor is invalid
      setInCave(false);
      setCaveTile(null);
      setCaveReturnPosition(null);
      setPlayer(prev => ({ ...prev, tileX: 0, tileY: 0, cellX: 2, cellY: 2 }));
      showMessage('🌅 You emerge from the cave...', 'success');
      return;
    }
    
    const targetTileKey = `${caveReturnPosition.tileX},${caveReturnPosition.tileY}`;
    const tileExists = overworldTiles[targetTileKey];
    
    if (!tileExists && caveReturnPosition.tileX !== 0 && caveReturnPosition.tileY !== 0) {
      // Tile doesn't exist and it's not town - fallback to town
      setInCave(false);
      setCaveTile(null);
      setCaveReturnPosition(null);
      setPlayer(prev => ({ ...prev, tileX: 0, tileY: 0, cellX: 2, cellY: 2 }));
      showMessage('🌅 You emerge from the cave...', 'success');
      return;
    }
    
    // Valid anchor - restore position atomically
    setPlayer(prev => ({ 
      ...prev, 
      tileX: caveReturnPosition.tileX, 
      tileY: caveReturnPosition.tileY, 
      cellX: caveReturnPosition.cellX, 
      cellY: caveReturnPosition.cellY 
    }));
    setInCave(false);
    setCaveTile(null);
    setCaveReturnPosition(null);
    showMessage('🌅 You emerge from the cave...', 'success');
  }, [caveReturnPosition, overworldTiles, showMessage]);
  
  // Enter tent
  const enterTent = useCallback(() => {
    if (!player.unlocks?.tent) {
      showMessage('🎪 You need to unlock the tent first.', 'warning');
      return;
    }
    
    if (tentUsedThisTrip) {
      showMessage('🎪 You already used the tent this trip.', 'warning');
      return;
    }
    
    if (player.tileX === 0 && player.tileY === 0) {
      showMessage('🎪 You can only pitch the tent outside of town.', 'warning');
      return;
    }
    
    setTentReturnPosition({ 
      tileX: player.tileX, 
      tileY: player.tileY, 
      cellX: player.cellX, 
      cellY: player.cellY 
    });
    const newTentTile = generateTentTile();
    setTentTile(newTentTile);
    setPlayer(prev => ({ ...prev, tileX: 0, tileY: 0, cellX: 1, cellY: 2 }));
    setInTent(true);
    setTentUsedThisTrip(true);
    showMessage('🎪 You pitch your tent and step inside...', 'info');
  }, [player.tileX, player.tileY, player.cellX, player.cellY, player.unlocks, tentUsedThisTrip, showMessage]);
  
  // Exit tent
  const exitTent = useCallback(() => {
    if (!tentReturnPosition) {
      setInTent(false);
      setTentTile(null);
      setTentReturnPosition(null);
      setPlayer(prev => ({ ...prev, tileX: 0, tileY: 0, cellX: 2, cellY: 2 }));
      showMessage('🎪 You pack up the tent...', 'success');
      return;
    }
    
    setPlayer(prev => ({ 
      ...prev, 
      tileX: tentReturnPosition.tileX, 
      tileY: tentReturnPosition.tileY, 
      cellX: tentReturnPosition.cellX, 
      cellY: tentReturnPosition.cellY 
    }));
    setInTent(false);
    setTentTile(null);
    setTentReturnPosition(null);
    showMessage('🎪 You pack up the tent...', 'success');
  }, [tentReturnPosition, showMessage]);
  
  // Tent bed interaction
  const useTentBed = useCallback(() => {
    setPlayer(prev => ({ ...prev, hp: derivedStats.maxHp }));
    showMessage('💤 You rest and recover.', 'success');
  }, [derivedStats.maxHp, showMessage]);
  
  // Tent mailbox interaction
  const [mailboxOpen, setMailboxOpen] = useState(false);
  
  // Placeholder for future structure entry (lairs/castles)
  const enterLair = useCallback(() => {
    // TODO: implement when lair system is added
  }, []);
  
  const enterCastle = useCallback(() => {
    // TODO: implement when castle system is added
  }, []);
  

  
  // Get equipped weapon
  const getEquippedWeapon = useCallback(() => {
    return player.equipment.weapon ? [player.equipment.weapon] : [];
  }, [player.equipment.weapon]);

  // Combat actions
  const attack = useCallback((weaponAction = 'punch') => {
    if (!combat || combatActionInProgress) return;
    setCombatActionInProgress(true);
    
    let damage = derivedStats.pow;
    let actionName = 'Attack';
    let hits = 1;
    
    // Apply weapon-specific actions
    switch (weaponAction) {
      case 'slash':
        actionName = 'Slash';
        damage = derivedStats.pow;
        break;
      case 'quickstrike':
        actionName = 'Quick Strike';
        hits = 2;
        damage = Math.floor(derivedStats.pow * 0.65);
        break;
      case 'cleave':
        actionName = 'Cleave';
        damage = Math.floor(derivedStats.pow * 1.5);
        break;
      case 'pierce':
        actionName = 'Pierce';
        damage = Math.floor(derivedStats.pow * 1.2);
        break;
      case 'thrust':
        actionName = 'Thrust';
        damage = Math.floor(derivedStats.pow * 1.1);
        break;
      case 'punch':
        actionName = 'Punch';
        damage = Math.max(1, Math.floor(derivedStats.pow * 0.4));
        break;
    }
    
    const totalDamage = damage * hits;

    // Player attack miss check
    const attackRoll = Math.floor(Math.random() * 6) + 1;
    const playerHits = attackRoll === 6 ? true : attackRoll === 1 ? false : (attackRoll + derivedStats.pow) >= combat.spd;

    if (!playerHits) {
      setCombatMessage(`💨 Your ${actionName} misses!`);
      setCombatLog(prev => [...prev, `💨 You use ${actionName} but miss!`]);

      // Monster still counterattacks after player miss
      setTimeout(() => {
        setCombat(currentCombat => {
          const currentDerivedStats = derivedStats;
          setPlayer(currentPlayer => {
            // Monster attack miss check
            const monsterRoll = Math.floor(Math.random() * 6) + 1;
            const monsterHits = monsterRoll === 1 ? false : monsterRoll === 6 ? true : (monsterRoll + currentCombat.pow) >= currentDerivedStats.spd;

            if (!monsterHits) {
              setCombatMessage(`🌀 The ${currentCombat.name} misses!`);
              setCombatLog(prev => [...prev, `🌀 ${currentCombat.name} attacks but misses!`]);
              setCombatActionInProgress(false);
              return currentPlayer;
            }

            const monsterDamage = Math.max(1, currentCombat.pow - Math.floor(currentDerivedStats.spd / 4));
            const newPlayerHp = currentPlayer.hp - monsterDamage;

            setCombatMessage(`💔 The ${currentCombat.name} strikes back for ${monsterDamage} damage!`);
            setCombatLog(prev => [...prev, `💔 ${currentCombat.name} dealt ${monsterDamage} damage!`]);

            if (newPlayerHp <= 0) {
              setGameOver(true);
              setCombat(null);
              setCombatMessage('');
              setCombatActionInProgress(false);
              return currentPlayer;
            }

            setCombatActionInProgress(false);
            return { ...currentPlayer, hp: newPlayerHp };
          });
          return currentCombat;
        });
      }, 1000);

      return;
    }

    const newMonsterHp = combat.hp - totalDamage;

    setCombatLog(prev => [...prev, `⚔️ You use ${actionName}! Dealt ${totalDamage} damage!`]);

    if (newMonsterHp <= 0) {
      // Monster defeated
      const goldReward = combat.goldReward;
      setPlayer(prev => ({ ...prev, gold: prev.gold + goldReward }));
      setStats(prev => ({ ...prev, monstersKilled: prev.monstersKilled + 1, goldEarned: prev.goldEarned + goldReward }));
      
      // Track quest progress
      if (inCave) {
        updateQuestProgress('KILL_COUNT', 'CAVE', 1);
      } else if (player.tileX !== 0 || player.tileY !== 0) {
        updateQuestProgress('KILL_COUNT', 'OVERWORLD', 1);
      }
      
      setCombatMessage(`🎉 You defeated the ${combat.name} and gained ${goldReward} gold!`);
      setCombatLog(prev => [...prev, `🎉 Victory! Gained ${goldReward} gold!`]);
      setTimeout(() => {
        setCombat(null);
        setCombatMessage('');
        setCombatActionInProgress(false);
      }, 2000);
    } else {
      // Monster survives, counterattacks - USE FUNCTIONAL UPDATE
      setCombat(prev => ({ ...prev, hp: newMonsterHp }));
      
      setTimeout(() => {
        // Recalculate damage from current combat state
        setCombat(currentCombat => {
          const currentDerivedStats = derivedStats;
          setPlayer(currentPlayer => {
            // Monster attack miss check
            const monsterRoll = Math.floor(Math.random() * 6) + 1;
            const monsterHits = monsterRoll === 1 ? false : monsterRoll === 6 ? true : (monsterRoll + currentCombat.pow) >= currentDerivedStats.spd;

            if (!monsterHits) {
              setCombatMessage(`🌀 The ${currentCombat.name} misses!`);
              setCombatLog(prev => [...prev, `🌀 ${currentCombat.name} attacks but misses!`]);
              setCombatActionInProgress(false);
              return currentPlayer;
            }

            const monsterDamage = Math.max(1, currentCombat.pow - Math.floor(currentDerivedStats.spd / 4));
            const newPlayerHp = currentPlayer.hp - monsterDamage;

            setCombatMessage(`💔 The ${currentCombat.name} strikes back for ${monsterDamage} damage!`);
            setCombatLog(prev => [...prev, `💔 ${currentCombat.name} dealt ${monsterDamage} damage!`]);

            if (newPlayerHp <= 0) {
              setGameOver(true);
              setCombat(null);
              setCombatMessage('');
              setCombatActionInProgress(false);
              return currentPlayer;
            }

            setCombatActionInProgress(false);
            return { ...currentPlayer, hp: newPlayerHp };
          });
          return currentCombat;
        });
      }, 1000);
    }
  }, [combat, derivedStats.pow, player.hp, derivedStats.spd, combatActionInProgress, inCave, player.tileX, player.tileY, updateQuestProgress, derivedStats]);
  
  const flee = useCallback(() => {
    if (!combat || !combat.canFlee || combatActionInProgress) return;
    setCombatActionInProgress(true);
    
    // Flee chance based on speed difference
    const fleeChance = 50 + (derivedStats.spd - combat.spd) * 10;
    const success = Math.random() * 100 < fleeChance;
    
    if (success) {
      setCombatMessage(`🏃 You escape from the ${combat.name}!`);
      setCombatLog(prev => [...prev, `✅ Escaped successfully!`]);
      setTimeout(() => {
        setCombat(null);
        setCombatMessage('');
        setCombatActionInProgress(false);
      }, 2000);
    } else {
      setCombatMessage(`❌ You fail to flee! The ${combat.name} strikes!`);
      setCombatLog(prev => [...prev, `❌ Failed to escape!`]);
      
      // Monster gets a free hit - USE FUNCTIONAL UPDATE
      setTimeout(() => {
        setCombat(currentCombat => {
          const currentDerivedStats = derivedStats;
          setPlayer(currentPlayer => {
            // Monster attack miss check (free hit after failed flee)
            const monsterRoll = Math.floor(Math.random() * 6) + 1;
            const monsterHits = monsterRoll === 6 ? true : (monsterRoll + currentCombat.pow) >= currentDerivedStats.spd;

            if (!monsterHits) {
              setCombatLog(prev => [...prev, `🌀 ${currentCombat.name} attacks but misses!`]);
              setCombatActionInProgress(false);
              return currentPlayer;
            }

            const monsterDamage = currentCombat.pow;
            const newPlayerHp = currentPlayer.hp - monsterDamage;

            setCombatLog(prev => [...prev, `💔 ${currentCombat.name} dealt ${monsterDamage} damage!`]);

            if (newPlayerHp <= 0) {
              setGameOver(true);
              setCombat(null);
              setCombatMessage('');
              setCombatActionInProgress(false);
              return currentPlayer;
            }

            setCombatActionInProgress(false);
            return { ...currentPlayer, hp: newPlayerHp };
          });
          return currentCombat;
        });
      }, 1000);
    }
  }, [combat, derivedStats.spd, player.hp, combatActionInProgress, derivedStats]);
  
  // Building interactions
  const useInn = useCallback(() => {
    setPlayer(prev => ({ ...prev, hp: derivedStats.maxHp }));
    showMessage('🏨 Rested at the Inn. Fully healed!', 'success');
    setActiveModal(null);
  }, [showMessage, derivedStats.maxHp]);
  
  const buyItem = useCallback((index) => {
    const item = shopItems[index];
    if (!item) return;
    
    setPlayer(p => {
      if (p.gold < item.cost) {
        showMessage('💰 Not enough gold!', 'warning');
        return p;
      }
      
      if (p.backpack.length >= p.backpackCap) {
        showMessage('🎒 Backpack full! Cannot buy.', 'warning');
        return p;
      }

      // Replace shop item
      setShopItems(prev => {
        const newItems = [...prev];
        const gameContent = buildGameContentForPlayer(p, currentPowergate);
        const newItem = getItemById(gameContent, pickShopItemId(gameContent));
        newItems[index] = newItem || prev[index];
        return newItems;
      });
      
      return { ...p, gold: p.gold - item.cost, backpack: [...p.backpack, item] };
    });
  }, [shopItems, showMessage]);
  
  const unequipToBackpack = useCallback((slot) => {
    setPlayer(prev => {
      const item = prev.equipment[slot];
      if (!item) return prev;
      
      if (prev.backpack.length >= prev.backpackCap) {
        // Trigger drop modal
        setDropModal({ isOpen: true, pendingItem: item, reason: 'unequip', slot });
        return prev;
      }
      
      return {
        ...prev,
        equipment: { ...prev.equipment, [slot]: null },
        backpack: [...prev.backpack, item]
      };
    });
  }, [showMessage]);
  
  const unequipToVault = useCallback((slot) => {
    if (activeModal !== 'vault' && !mailboxOpen) {
      showMessage('⚠️ Can only deposit to vault inside vault building.', 'warning');
      return;
    }
    
    setPlayer(prev => {
      const item = prev.equipment[slot];
      if (!item) return prev;
      
      if (prev.vaultItems.length >= 8) {
        showMessage('🏦 Vault full! Cannot deposit.', 'warning');
        return prev;
      }
      
      return {
        ...prev,
        equipment: { ...prev.equipment, [slot]: null },
        vaultItems: [...prev.vaultItems, item]
      };
    });
  }, [activeModal, mailboxOpen, showMessage]);
  
  const equipFromBackpack = useCallback((itemIndex) => {
    setPlayer(prev => {
      const item = prev.backpack[itemIndex];
      if (!item) return prev;
      
      const category = getItemCategory(item);
      if (!['weapon','armor','boots','magic'].includes(category)) {
        showMessage('⚠️ Cannot equip this item type.', 'warning');
        return prev;
      }
      
      if (prev.equipment[category]) {
        showMessage(`⚠️ ${category.toUpperCase()} slot already filled. Unequip first.`, 'warning');
        return prev;
      }
      
      return {
        ...prev,
        backpack: prev.backpack.filter((_, i) => i !== itemIndex),
        equipment: { ...prev.equipment, [category]: item }
      };
    });
  }, [showMessage]);
  
  const sellFromBackpack = useCallback((itemIndex) => {
    setPlayer(prev => {
      const item = prev.backpack[itemIndex];
      if (!item) return prev;
      
      const sellPrice = Math.floor(item.cost / 2);
      updateQuestProgress('SELL_ITEM', null, 1);
      
      return {
        ...prev,
        gold: prev.gold + sellPrice,
        backpack: prev.backpack.filter((_, i) => i !== itemIndex)
      };
    });
  }, [updateQuestProgress]);
  
  const sellEquipped = useCallback((slot) => {
    setPlayer(prev => {
      const item = prev.equipment[slot];
      if (!item) return prev;
      
      const sellPrice = Math.floor(item.cost / 2);
      updateQuestProgress('SELL_ITEM', null, 1);
      
      return {
        ...prev,
        gold: prev.gold + sellPrice,
        equipment: { ...prev.equipment, [slot]: null }
      };
    });
  }, [updateQuestProgress]);
  
  const dropFromBackpack = useCallback((itemIndex) => {
    setPlayer(prev => {
      const item = prev.backpack[itemIndex];
      if (!item) return prev;
      
      showMessage(`🗑️ Dropped ${item.name}.`, 'info');
      return {
        ...prev,
        backpack: prev.backpack.filter((_, i) => i !== itemIndex)
      };
    });
  }, [showMessage]);

  const useItemOutOfCombat = useCallback((itemIndex) => {
    setPlayer(prev => {
      const item = prev.backpack[itemIndex];
      if (!item || item.type !== 'consumable' || !item.healAmount) return prev;
      
      // Check if already at full health
      if (prev.hp >= derivedStats.maxHp) {
        showMessage(`You're already at full health.`, 'info');
        return prev;
      }
      
      const healAmount = item.healAmount;
      const newHp = Math.min(derivedStats.maxHp, prev.hp + healAmount);
      const actualHealing = newHp - prev.hp;
      
      showMessage(`🌿 Used ${item.name}. Healed ${actualHealing} HP.`, 'success');
      
      return {
        ...prev,
        hp: newHp,
        backpack: prev.backpack.filter((_, i) => i !== itemIndex)
      };
    });
  }, [derivedStats.maxHp, showMessage]);
  
  const backpackToVault = useCallback((itemIndex) => {
    if (activeModal !== 'vault' && !mailboxOpen) {
      showMessage('⚠️ Can only deposit to vault inside vault building.', 'warning');
      return;
    }
    
    setPlayer(prev => {
      const item = prev.backpack[itemIndex];
      if (!item) return prev;
      
      if (prev.vaultItems.length >= 8) {
        showMessage('🏦 Vault full!', 'warning');
        return prev;
      }
      
      return {
        ...prev,
        backpack: prev.backpack.filter((_, i) => i !== itemIndex),
        vaultItems: [...prev.vaultItems, item]
      };
    });
  }, [activeModal, mailboxOpen, showMessage]);
  
  const vaultToBackpack = useCallback((vaultIndex) => {
    if (activeModal !== 'vault') {
      showMessage('⚠️ Can only withdraw from vault inside vault building.', 'warning');
      return;
    }
    
    setPlayer(prev => {
      const item = prev.vaultItems[vaultIndex];
      if (!item) return prev;
      
      if (prev.backpack.length >= prev.backpackCap) {
        showMessage('🎒 Backpack full!', 'warning');
        return prev;
      }
      
      return {
        ...prev,
        vaultItems: prev.vaultItems.filter((_, i) => i !== vaultIndex),
        backpack: [...prev.backpack, item]
      };
    });
  }, [activeModal, showMessage]);
  
  const vaultToEquip = useCallback((vaultIndex) => {
    if (activeModal !== 'vault') {
      showMessage('⚠️ Can only withdraw from vault inside vault building.', 'warning');
      return;
    }
    
    setPlayer(prev => {
      const item = prev.vaultItems[vaultIndex];
      if (!item) return prev;
      
      const category = getItemCategory(item);
      if (!['weapon','armor','boots','magic'].includes(category)) {
        showMessage('⚠️ Cannot equip this item type.', 'warning');
        return prev;
      }
      
      if (prev.equipment[category]) {
        showMessage(`⚠️ ${category.toUpperCase()} slot already filled.`, 'warning');
        return prev;
      }
      
      return {
        ...prev,
        vaultItems: prev.vaultItems.filter((_, i) => i !== vaultIndex),
        equipment: { ...prev.equipment, [category]: item }
      };
    });
  }, [activeModal, showMessage]);
  
  const handleDropChoice = useCallback((dropBackpackIndex) => {
    const { pendingItem, reason, slot } = dropModal;
    
    if (dropBackpackIndex !== null) {
      // Drop selected backpack item to make room
      setPlayer(prev => {
        showMessage(`🗑️ Dropped ${prev.backpack[dropBackpackIndex].name} to make room.`, 'info');
        const newBackpack = prev.backpack.filter((_, i) => i !== dropBackpackIndex);
        
        if (reason === 'unequip') {
          return {
            ...prev,
            equipment: { ...prev.equipment, [slot]: null },
            backpack: [...newBackpack, pendingItem]
          };
        } else if (reason === 'loot') {
          return {
            ...prev,
            backpack: [...newBackpack, pendingItem]
          };
        }
        
        return prev;
      });
    } else {
      // Drop the pending item
      if (reason === 'unequip') {
        setPlayer(prev => ({
          ...prev,
          equipment: { ...prev.equipment, [slot]: null }
        }));
        showMessage(`🗑️ Dropped ${pendingItem.name}.`, 'info');
      } else {
        showMessage(`🗑️ Left ${pendingItem.name} behind.`, 'info');
      }
    }
    
    setDropModal({ isOpen: false, pendingItem: null, reason: '' });
  }, [dropModal, showMessage]);
  
  const useItemInCombat = useCallback((itemIndex) => {
    if (!combat || combatActionInProgress) return;
    setCombatActionInProgress(true);
    
    setPlayer(prev => {
      const item = prev.backpack[itemIndex];
      if (!item || !item.usableInCombat) {
        setCombatActionInProgress(false);
        return prev;
      }
      
      switch (item.combatEffectType) {
        case 'heal':
          const healAmount = item.healAmount || 5;
          setCombatMessage(`🌿 You use ${item.name} and recover ${healAmount} HP!`);
          setCombatLog(prevLog => [...prevLog, `🌿 Used ${item.name}! Healed ${healAmount} HP.`]);
          
          // Monster still gets to attack - USE FUNCTIONAL UPDATE
          setTimeout(() => {
            setCombat(currentCombat => {
              const currentDerivedStats = derivedStats;
              setPlayer(currentPlayer => {
                // Monster attack miss check
                const monsterRoll = Math.floor(Math.random() * 6) + 1;
                const monsterHits = monsterRoll === 6 ? true : (monsterRoll + currentCombat.pow) >= currentDerivedStats.spd;
                
                if (!monsterHits) {
                  setCombatLog(prevLog => [...prevLog, `🌀 ${currentCombat.name} attacks but misses!`]);
                  setCombatActionInProgress(false);
                  return currentPlayer;
                }
                
                const monsterDamage = Math.max(1, currentCombat.pow - Math.floor(currentDerivedStats.spd / 4));
                const newPlayerHp = currentPlayer.hp - monsterDamage;
                
                setCombatLog(prevLog => [...prevLog, `💔 ${currentCombat.name} dealt ${monsterDamage} damage!`]);
                
                if (newPlayerHp <= 0) {
                  setGameOver(true);
                  setCombat(null);
                  setCombatMessage('');
                  setCombatActionInProgress(false);
                  return currentPlayer;
                }
                
                setCombatActionInProgress(false);
                return { ...currentPlayer, hp: newPlayerHp };
              });
              return currentCombat;
            });
          }, 1000);
          
          return {
            ...prev,
            hp: Math.min(derivedStats.maxHp, prev.hp + healAmount),
            backpack: prev.backpack.filter((_, i) => i !== itemIndex)
          };
          
        case 'autoFlee':
          setCombatMessage(`🗿 The rune flares and you slip away into the fog.`);
          setCombatLog(prevLog => [...prevLog, `🗿 Used ${item.name}!`, `✅ Escaped successfully!`]);
          setTimeout(() => {
            setCombat(null);
            setCombatMessage('');
            setCombatActionInProgress(false);
          }, 2000);
          
          return {
            ...prev,
            backpack: prev.backpack.filter((_, i) => i !== itemIndex)
          };
          
        default:
          setCombatActionInProgress(false);
          return prev;
      }
    });
  }, [combat, combatActionInProgress, derivedStats]);

  const handleUseItem = useCallback((itemIndex) => {
    if (combat) {
      // In combat: use existing combat item handler
      useItemInCombat(itemIndex);
    } else {
      // Out of combat: instant healing
      useItemOutOfCombat(itemIndex);
    }
  }, [combat, useItemInCombat, useItemOutOfCombat]);
  
  const depositGold = useCallback((amount) => {
    const actualAmount = amount === 'all' ? player.gold : Math.min(amount, player.gold);
    if (actualAmount <= 0) return;
    
    setPlayer(prev => ({
      ...prev,
      gold: prev.gold - actualAmount,
      bankGold: prev.bankGold + actualAmount
    }));
  }, [player.gold]);
  
  const withdrawGold = useCallback((amount) => {
    const actualAmount = amount === 'all' ? player.bankGold : Math.min(amount, player.bankGold);
    if (actualAmount <= 0) return;
    
    setPlayer(prev => ({
      ...prev,
      gold: prev.gold + actualAmount,
      bankGold: prev.bankGold - actualAmount
    }));
  }, [player.bankGold]);
  
  // Restart game (keep bank & vault)
  const restartGame = useCallback(() => {
    setPlayer({
      basePow: 3,
      baseSpd: 3,
      baseMaxHp: 20,
      hp: 20,
      gold: 0,
      bankGold: player.bankGold,
      tileX: 0,
      tileY: 0,
      cellX: 2,
      cellY: 2,
      facing: 'south',
      equipment: {
        weapon: null,
        armor: null,
        boots: null,
        magic: null
      },
      backpack: [],
      backpackCap: 8,
      vaultItems: player.vaultItems
      });
    setOverworldTiles({ '0,0': generateTownTile() });
    setCaveTile(null);
    setExpeditionId(1);
    setInCave(false);
    setCaveReturnPosition(null);
    setActiveModal(null);
    const restartContent = buildGameContentForPlayer({ basePow: 3, baseSpd: 3, baseMaxHp: 20, equipment: {} }, 0);
    setShopItems([
      getItemById(restartContent, pickShopItemId(restartContent)),
      getItemById(restartContent, pickShopItemId(restartContent)),
      getItemById(restartContent, pickShopItemId(restartContent)),
      getItemById(restartContent, pickShopItemId(restartContent))
    ].filter(Boolean));
    setCombat(null);
    setCombatLog([]);
    setCombatMessage('');
    setLastRolls(null);
    setGameOver(false);
    setStats({ monstersKilled: 0, goldEarned: 0, tilesExplored: 0 });
    setMessage(null);
    setMessageQueue([]);
  }, [player.bankGold, player.vaultItems]);
  
  // New Game (clear everything)
  const newGame = useCallback(() => {
    clearSave();
    setPlayer({
      basePow: 3,
      baseSpd: 3,
      baseMaxHp: 20,
      hp: 20,
      gold: 0,
      bankGold: 0,
      tileX: 0,
      tileY: 0,
      cellX: 2,
      cellY: 2,
      facing: 'south',
      equipment: {
        weapon: null,
        armor: null,
        boots: null,
        magic: null
      },
      backpack: [],
      backpackCap: 8,
      vaultItems: [],
      unlocks: {}
      });
      setOverworldTiles({ '0,0': generateTownTile() });
    setCaveTile(null);
    setExpeditionId(1);
    setInCave(false);
    setCaveReturnPosition(null);
    setActiveModal(null);
    setActiveQuest(null);
    setCurrentPowergate(0);
    setCompletedQuestsByGate({});
    const newGameContent = buildGameContentForPlayer({ basePow: 3, baseSpd: 3, baseMaxHp: 20, equipment: {} }, 0);
    setShopItems([
      getItemById(newGameContent, pickShopItemId(newGameContent)),
      getItemById(newGameContent, pickShopItemId(newGameContent)),
      getItemById(newGameContent, pickShopItemId(newGameContent)),
      getItemById(newGameContent, pickShopItemId(newGameContent))
    ].filter(Boolean));
    setCombat(null);
    setCombatLog([]);
    setCombatMessage('');
    setLastRolls(null);
    setGameOver(false);
    setStats({ monstersKilled: 0, goldEarned: 0, tilesExplored: 0 });
    setMessage(null);
    setMessageQueue([]);
  }, []);
  
  // Keyboard controls (continuous movement)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver || movingRef.current) return;

      // Backpack toggle
      if ((e.key === 'i' || e.key === 'I') && !combat) {
        setBackpackOpen(prev => !prev);
        return;
      }
      
      // Tent toggle
      if ((e.key === 't' || e.key === 'T') && !combat && !activeModal && !inCave && !inTent) {
        enterTent();
        return;
      }

      if (activeModal || combat || backpackOpen) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          movePlayer(0, -1);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          movePlayer(0, 1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          movePlayer(-1, 0);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          movePlayer(1, 0);
          break;
        case 'e':
        case 'E':
          if (currentBuilding) {
            setActiveModal(currentBuilding);
          } else if (onCaveEntrance) {
            enterCave();
          } else if (onStairway) {
            exitCave();
          } else if (onTentExit) {
            exitTent();
          } else if (onTentBed) {
            useTentBed();
          } else if (onTentMailbox) {
            setMailboxOpen(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, activeModal, combat, backpackOpen, movePlayer, currentBuilding, onCaveEntrance, onStairway, onTentExit, onTentBed, onTentMailbox, enterCave, exitCave, exitTent, useTentBed, enterTent, inCave, inTent]);
  
  // Minimap bounds calculation
  const minimap = useMemo(() => {
    if (inCave || inTent) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
    }

    const keys = Object.keys(overworldTiles);
    if (keys.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
    }

    const coords = keys.map(k => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });

    const minX = Math.min(...coords.map(c => c.x));
    const maxX = Math.max(...coords.map(c => c.x));
    const minY = Math.min(...coords.map(c => c.y));
    const maxY = Math.max(...coords.map(c => c.y));

    return {
      minX, maxX, minY, maxY,
      width: (maxX - minX + 1),
      height: (maxY - minY + 1)
    };
  }, [overworldTiles, inCave, inTent]);

  // Camera/viewport calculation
  const cameraViewport = useMemo(() => {
    if (!currentTile) return { camX: 0, camY: 0, cells: [] };

    const halfViewX = Math.floor(viewportWidth / 2);
    const halfViewY = Math.floor(viewportHeight / 2);
    
    // Adjust for tent (3 wide) or normal (6 wide)
    const gridWidth = inTent ? 3 : 6;
    const gridHeight = inTent ? 4 : 6;
    
    const camX = Math.max(0, Math.min(player.cellX - halfViewX, gridWidth - viewportWidth));
    const camY = Math.max(0, Math.min(player.cellY - halfViewY, gridHeight - viewportHeight));

    const visibleCells = currentTile.cells.filter(cell => 
      cell.x >= camX && cell.x < camX + viewportWidth &&
      cell.y >= camY && cell.y < camY + viewportHeight
    );

    return { camX, camY, cells: visibleCells };
    }, [currentTile, player.cellX, player.cellY, viewportWidth, viewportHeight, inTent]);

    // Measure grid size for player animation
    useEffect(() => {
      if (!gridRef.current) return;

      const updateSize = () => {
        if (gridRef.current) {
          const rect = gridRef.current.getBoundingClientRect();
          setCellSizeState(rect.width / viewportWidth);
        }
      };

      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }, [viewportWidth]);

    // Calculate player pixel position
    const playerPixelPos = useMemo(() => {
      const hudHeight = isLandscape ? 40 : (viewport.h < 420 ? 48 : 56);
      const size = cellSizeState || Math.floor(Math.min(viewport.w / viewportWidth, (viewport.h - hudHeight) / viewportHeight));
      return {
        x: (player.cellX - cameraViewport.camX) * size,
        y: (player.cellY - cameraViewport.camY) * size,
        size
      };
    }, [player.cellX, player.cellY, cameraViewport.camX, cameraViewport.camY, cellSizeState, viewport.w, viewport.h, viewportWidth, viewportHeight, isLandscape]);



  // Interact action
  const handleInteract = useCallback(() => {
    if (currentBuilding) {
      setActiveModal(currentBuilding);
    } else if (onCaveEntrance) {
      enterCave();
    } else if (onStairway) {
      exitCave();
    } else if (onTentExit) {
      exitTent();
    } else if (onTentBed) {
      useTentBed();
    } else if (onTentMailbox) {
      setMailboxOpen(true);
    } else {
      showMessage('Nothing to interact with', 'info');
    }
  }, [currentBuilding, onCaveEntrance, onStairway, onTentExit, onTentBed, onTentMailbox, enterCave, exitCave, exitTent, useTentBed, showMessage]);

  // Viewport tracking (visual viewport for mobile)
  useEffect(() => {
    const updateViewport = () => {
      const vv = window.visualViewport;
      const w = vv?.width ?? window.innerWidth;
      const h = vv?.height ?? window.innerHeight;
      setViewport({ w, h });
      setIsLandscape(window.matchMedia('(orientation: landscape)').matches);
      document.documentElement.style.setProperty('--app-h', `${h}px`);
      document.documentElement.style.setProperty('--app-w', `${w}px`);
    };
    
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);
    
    const mediaQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = () => setIsLandscape(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  // Fullscreen tracking
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFS);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else {
          showMessage('Fullscreen not supported on this browser', 'warning');
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch (err) {
      showMessage('Fullscreen not supported on this browser', 'warning');
    }
  }, [isFullscreen, showMessage]);

  // Game Over Screen
  if (gameOver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <Card className="bg-slate-800/90 border-red-900/50 p-8 max-w-md">
            <Skull className="w-20 h-20 mx-auto text-red-500 mb-4" />
            <h1 className="text-4xl font-bold text-red-400 mb-2">Game Over</h1>
            <p className="text-slate-400 mb-6">The fog has claimed another soul...</p>
            
            <div className="space-y-2 text-left mb-6 bg-slate-900/50 rounded-lg p-4">
              <div className="flex justify-between text-slate-300">
                <span>Monsters Slain:</span>
                <span className="text-amber-400">{stats.monstersKilled}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Gold Earned:</span>
                <span className="text-yellow-400">{stats.goldEarned}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Tiles Explored:</span>
                <span className="text-blue-400">{stats.tilesExplored}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={restartGame} className="flex-1 bg-red-600 hover:bg-red-700">
                Continue (Keep Bank & Vault)
              </Button>
              <Button onClick={newGame} variant="outline" className="flex-1 bg-slate-700 hover:bg-slate-600">
                New Game
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Building icon mapping
  const BUILDING_ICONS = {
    inn: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/pixil-frame-0%20(2).png',
    bank: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/bank2.png',
    shop: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/shop3.png',
    vault: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Valt3.png',
    fairy: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693b2cad12eb6b7775e9c810/0db77d22a_south.png'
  };

  // Main Game Screen
  const isSmallScreen = viewport.h < 420;
  const topHudHeight = isLandscape ? 40 : (isSmallScreen ? 48 : 56);
  const cellSize = Math.floor(Math.min(viewport.w / viewportWidth, (viewport.h - topHudHeight) / viewportHeight));

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden"
      style={{ 
        width: '100dvw',
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)'
      }}
    >
      {/* TOP HUD */}
      <div 
        className="flex items-center justify-between px-2 bg-slate-800/90 border-b border-slate-700 shrink-0"
        style={{ height: topHudHeight }}
      >
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-400" />
            <span className="text-white font-medium">{player.hp}/{derivedStats.maxHp}</span>
          </div>
          <div className="flex items-center gap-1">
            <Sword className="w-3 h-3 text-orange-400" />
            <span className="text-white">{derivedStats.pow}</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-white">{derivedStats.spd}</span>
          </div>
          <div className="flex items-center gap-1">
            <Coins className="w-3 h-3 text-yellow-500" />
            <span className="text-white">{player.gold}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            onClick={toggleFullscreen}
            size="sm" 
            className="bg-slate-700 hover:bg-slate-600 h-7 px-2"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? '⊗' : '⊕'}
          </Button>
          <Button 
            onClick={() => setBackpackOpen(true)} 
            size="sm" 
            className="bg-slate-700 hover:bg-slate-600 h-7 px-2"
          >
            <ShoppingBag className="w-3 h-3 mr-1" />
            {player.backpack.length}/{player.backpackCap}
          </Button>
        </div>
      </div>

      {/* CENTER GAME VIEW (VIEWPORT) - FULL HEIGHT */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            ref={gridRef}
            className="grid gap-0 border-2 border-slate-700 rounded overflow-hidden relative"
            style={{ 
              gridTemplateColumns: `repeat(${viewportWidth}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${viewportHeight}, ${cellSize}px)`,
              width: viewportWidth * cellSize,
              height: viewportHeight * cellSize
            }}
          >
        {cameraViewport.cells.map((cell, i) => {
                  const tileData = getTileRenderData(cell.tileId, gameContent, currentTile?.isTown, currentTile?.isTent);

                  return (
                    <div
                      key={`${cell.x}-${cell.y}`}
                      className="relative overflow-hidden"
                      style={{
                        width: cellSize,
                        height: cellSize, 
                        backgroundColor: tileData.bg,
                        backgroundImage: tileData.bgImage ? `url('${tileData.bgImage}')` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        imageRendering: 'pixelated'
                      }}
                    >
                      {/* Building icons for town (except inn, shop, bank, and vault, which are rendered as overlays) */}
                      {cell.building && cell.building !== 'inn' && cell.building !== 'shop' && cell.building !== 'bank' && cell.building !== 'vault' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <img 
                            src={BUILDING_ICONS[cell.building]}
                            alt={cell.building}
                            className="w-full h-full object-contain pointer-events-none"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                      )}

                      {/* Cave entrance */}
                      {cell.hasCaveEntrance && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <img 
                            src="https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Cave.png"
                            alt="Cave entrance"
                            className="w-full h-full object-cover pointer-events-none"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                      )}

                      {/* Stairway */}
                      {cell.hasStairway && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl z-10">
                          🪜
                        </div>
                      )}
                      
                      {/* Tent Exit */}
                      {cell.isTentExit && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl z-10">
                          🚪
                        </div>
                      )}
                      
                      {/* Tent Bed */}
                      {cell.isTentBed && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl z-10">
                          🛏️
                        </div>
                      )}
                      
                      {/* Tent Mailbox */}
                      {cell.isTentMailbox && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl z-10">
                          📮
                        </div>
                      )}

                      {/* Treasure */}
                      {cell.hasTreasure && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <img 
                            src="https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/treasure.png"
                            alt="Treasure"
                            className="w-full h-full object-contain"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                  })}

                  {/* Inn Building Overlay (2x2) */}
                  {currentTile?.isTown && cameraViewport.cells.some(c => c.building === 'inn' && c.x === 1 && c.y === 0) && (
                    <div
                      className="absolute pointer-events-none z-40"
                      style={{
                        left: (1 - cameraViewport.camX) * cellSize,
                        top: (0 - cameraViewport.camY) * cellSize,
                        width: cellSize * 2,
                        height: cellSize * 2
                      }}
                    >
                      <img 
                        src={BUILDING_ICONS.inn}
                        alt="Inn"
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}

                  {/* Shop Building Overlay (2x2) */}
                  {currentTile?.isTown && cameraViewport.cells.some(c => c.building === 'shop' && c.x === 1 && c.y === 3) && (
                    <div
                      className="absolute pointer-events-none z-40"
                      style={{
                        left: (1 - cameraViewport.camX) * cellSize,
                        top: (3 - cameraViewport.camY) * cellSize,
                        width: cellSize * 2,
                        height: cellSize * 2
                      }}
                    >
                      <img 
                        src={BUILDING_ICONS.shop}
                        alt="Shop"
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}
      
                  {/* Bank Building Overlay (2x2) */}
                  {currentTile?.isTown && cameraViewport.cells.some(c => c.building === 'bank' && c.x === 4 && c.y === 0) && (
                    <div
                      className="absolute pointer-events-none z-40"
                      style={{
                        left: (4 - cameraViewport.camX) * cellSize,
                        top: (0 - cameraViewport.camY) * cellSize,
                        width: cellSize * 2,
                        height: cellSize * 2
                      }}
                    >
                      <img 
                        src={BUILDING_ICONS.bank}
                        alt="Bank"
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}
      
                  {/* Vault Building Overlay (2x2) */}
                  {currentTile?.isTown && cameraViewport.cells.some(c => c.building === 'vault' && c.x === 4 && c.y === 3) && (
                    <div
                      className="absolute pointer-events-none z-40"
                      style={{
                        left: (4 - cameraViewport.camX) * cellSize,
                        top: (3 - cameraViewport.camY) * cellSize,
                        width: cellSize * 2,
                        height: cellSize * 2
                      }}
                    >
                      <img 
                        src={BUILDING_ICONS.vault}
                        alt="Vault"
                        className="w-full h-full object-contain"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}

                  {/* Animated Player Sprite */}
            {cellSizeState > 0 && currentTile && (
              <motion.div
                className="absolute z-50 pointer-events-none"
                animate={{ 
                  x: playerPixelPos.x, 
                  y: playerPixelPos.y 
                }}
                transition={{ 
                  type: "tween", 
                  duration: 0.12, 
                  ease: "linear" 
                }}
                onAnimationComplete={releaseMoveLock}
                style={{
                  width: playerPixelPos.size,
                  height: playerPixelPos.size
                }}
              >
              <img 
                src={
                  player.facing === 'north' ? 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/HeroBack.png' :
                  player.facing === 'east' ? 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/HeroRight.png' :
                  player.facing === 'west' ? 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/HeroLeft.png' :
                  'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/HeroFront.png'
                }
                alt="Player"
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              </motion.div>
            )}
          </div>
        </div>

                        {/* FLOATING OVERLAY CONTROLS */}
                        {!combat && !activeModal && (
                        <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ 
                        paddingBottom: 'env(safe-area-inset-bottom)',
                        paddingLeft: 'env(safe-area-inset-left)',
                        paddingRight: 'env(safe-area-inset-right)'
                        }}
                        >
                        {/* D-pad (bottom-left) */}
                        <div 
                        className="absolute left-2 bottom-2 pointer-events-auto bg-slate-900/50 backdrop-blur-md rounded-xl p-2 border border-white/10"
                        style={{ zIndex: 1000 }}
                        >
                        <div className="grid grid-cols-3 gap-1" style={{ width: 'clamp(90px, 18vw, 130px)' }}>
                        <div />
                        <Button 
                        onClick={() => movePlayer(0, -1)} 
                        size="icon" 
                        className="bg-slate-700/80 hover:bg-slate-600 aspect-square"
                        style={{ width: 'clamp(28px, 6vw, 40px)', height: 'clamp(28px, 6vw, 40px)' }}
                        >
                        <ArrowUp className="w-4 h-4" />
                        </Button>
                        <div />
                        <Button 
                        onClick={() => movePlayer(-1, 0)} 
                        size="icon" 
                        className="bg-slate-700/80 hover:bg-slate-600 aspect-square"
                        style={{ width: 'clamp(28px, 6vw, 40px)', height: 'clamp(28px, 6vw, 40px)' }}
                        >
                        <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div />
                        <Button 
                        onClick={() => movePlayer(1, 0)} 
                        size="icon" 
                        className="bg-slate-700/80 hover:bg-slate-600 aspect-square"
                        style={{ width: 'clamp(28px, 6vw, 40px)', height: 'clamp(28px, 6vw, 40px)' }}
                        >
                        <ArrowRight className="w-4 h-4" />
                        </Button>
                        <div />
                        <Button 
                        onClick={() => movePlayer(0, 1)} 
                        size="icon" 
                        className="bg-slate-700/80 hover:bg-slate-600 aspect-square"
                        style={{ width: 'clamp(28px, 6vw, 40px)', height: 'clamp(28px, 6vw, 40px)' }}
                        >
                        <ArrowDown className="w-4 h-4" />
                        </Button>
                        <div />
                        </div>
                        </div>



                        {/* Action stack (bottom-right) */}
                        <div 
                        className="absolute right-2 bottom-2 pointer-events-auto bg-slate-900/50 backdrop-blur-md rounded-xl p-2 border border-white/10"
                        style={{ zIndex: 1000 }}
                        >
                        <div className="flex flex-col gap-1" style={{ width: 'clamp(70px, 14vw, 100px)' }}>
                        <Button 
                          onClick={handleInteract}
                          disabled={!currentBuilding && !onCaveEntrance && !onStairway && !onTentExit && !onTentBed && !onTentMailbox}
                          className="bg-amber-600/90 hover:bg-amber-700 disabled:opacity-30 text-xs whitespace-nowrap"
                          style={{ height: 'clamp(36px, 7vh, 48px)' }}
                        >
                          {currentBuilding === 'fairy' ? 'Talk' :
                           currentBuilding ? 'Enter' : 
                           onCaveEntrance ? 'Cave' : 
                           onStairway ? 'Exit' :
                           onTentExit ? 'Exit' :
                           onTentBed ? 'Bed' :
                           onTentMailbox ? 'Mail' :
                           'E'}
                        </Button>
                        <Button 
                        onClick={() => setMinimapOpen(true)} 
                        className="bg-slate-700/80 hover:bg-slate-600 p-0"
                        title="Minimap"
                        style={{ height: 'clamp(36px, 7vh, 48px)' }}
                        >
                        <MapPin className="w-4 h-4" />
                        </Button>
                        {player.unlocks?.tent && !inCave && !inTent && (
                          <Button 
                            onClick={enterTent}
                            disabled={tentUsedThisTrip || (player.tileX === 0 && player.tileY === 0)}
                            className="bg-amber-700/80 hover:bg-amber-600 disabled:opacity-30 p-0"
                            title={tentUsedThisTrip ? 'Tent used this trip' : (player.tileX === 0 && player.tileY === 0) ? 'Cannot use in town' : 'Pitch Tent (T)'}
                            style={{ height: 'clamp(36px, 7vh, 48px)' }}
                          >
                            🎪
                          </Button>
                        )}
                        </div>
                        </div>
                        </div>
                        )}
                        </div>

        {/* Minimap Modal */}
        <AnimatePresence>
          {minimapOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2"
              onClick={() => setMinimapOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 border-slate-700 rounded-xl shadow-2xl w-full overflow-hidden"
                style={{ 
                  maxWidth: 'min(100vw - 16px, 600px)',
                  maxHeight: 'calc(100dvh - 16px)'
                }}
              >
                <div className="text-center p-4 border-b border-slate-700">
                  <MapPin className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <h2 className="text-xl font-bold text-slate-300">Minimap</h2>
                </div>

                <div className="p-4">
                  {inCave ? (
                    <div className="bg-slate-800/50 rounded-lg p-6 text-center text-slate-400 mb-3">
                      Minimap unavailable in caves
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 rounded-lg p-3 mb-3 max-w-[90vw] max-h-[70vh] overflow-hidden">
                      <div className="relative w-full h-[60vh] overflow-hidden bg-slate-950/40 rounded">
                        <div
                          className="absolute grid gap-[2px] p-2"
                          style={{
                            gridTemplateColumns: `repeat(${minimap.width}, 10px)`,
                            gridTemplateRows: `repeat(${minimap.height}, 10px)`,
                            left: '50%',
                            top: '50%',
                            transform: `translate(calc(-50% - ${(player.tileX - minimap.minX) * 12}px), calc(-50% - ${(player.tileY - minimap.minY) * 12}px))`
                          }}
                        >
                          {Array.from({ length: minimap.height }).map((_, row) =>
                            Array.from({ length: minimap.width }).map((_, col) => {
                              const tileX = minimap.minX + col;
                              const tileY = minimap.minY + row;
                              const key = `${tileX},${tileY}`;
                              const tile = overworldTiles[key];
                              const isTown = tile?.isTown;
                              const isCurrent = !inCave && player.tileX === tileX && player.tileY === tileY;

                              if (!tile) {
                                return (
                                  <div
                                    key={`${col}-${row}`}
                                    className="w-[10px] h-[10px] rounded-[2px] bg-slate-900/30 border border-slate-800/30"
                                  />
                                );
                              }

                              return (
                                <div
                                  key={`${col}-${row}`}
                                  className={[
                                    "w-[10px] h-[10px] rounded-[2px] border flex items-center justify-center",
                                    isTown ? "bg-amber-500 border-amber-300" :
                                    isCurrent ? "bg-blue-500 border-blue-300" :
                                    "bg-emerald-700 border-emerald-600"
                                  ].join(" ")}
                                >
                                  {isTown ? <span className="text-[8px] leading-none">🏰</span> : isCurrent ? <span className="text-[8px] leading-none">•</span> : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    onClick={() => setMinimapOpen(false)}
                    variant="outline"
                    className="w-full bg-slate-700 hover:bg-slate-600 text-sm h-9"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backpack Modal */}
        <AnimatePresence>
          {backpackOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={() => setBackpackOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 border-slate-700 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="text-center mb-6">
                  <ShoppingBag className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                  <h2 className="text-3xl font-bold text-slate-300 mb-2">Backpack & Equipment</h2>
                </div>

                {/* Equipment Slots */}
                <div className="mb-6">
                  <h3 className="text-white font-semibold mb-3">Equipment Slots</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['weapon', 'armor', 'boots', 'magic'].map(slot => {
                      const item = player.equipment[slot];
                      return (
                        <div key={slot} className="bg-slate-800/50 rounded-lg p-3">
                          <div className="text-xs text-slate-400 mb-2 capitalize">{slot}</div>
                          {item ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{item.emoji}</span>
                                <div className="flex-1">
                                  <div className="text-white text-sm font-medium">{item.name}</div>
                                  <div className="text-xs text-slate-400">
                                    {item.powMod !== 0 && <span className="text-orange-400">POW {item.powMod > 0 ? '+' : ''}{item.powMod} </span>}
                                    {item.spdMod !== 0 && <span className="text-yellow-400">SPD {item.spdMod > 0 ? '+' : ''}{item.spdMod} </span>}
                                    {item.maxHpMod !== 0 && <span className="text-red-400">HP +{item.maxHpMod}</span>}
                                  </div>
                                </div>
                              </div>
                              <Button
                                onClick={() => unequipToBackpack(slot)}
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-7"
                              >
                                Unequip → Backpack
                              </Button>
                            </>
                          ) : (
                            <div className="text-slate-500 text-xs text-center py-4">Empty</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Backpack */}
                <div className="mb-6">
                  <h3 className="text-white font-semibold mb-3">Backpack ({player.backpack.length}/{player.backpackCap})</h3>
                  {player.backpack.length > 0 ? (
                    <div className="space-y-2">
                      {player.backpack.map((item, i) => (
                        <div key={i} className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{item.emoji}</span>
                            <div>
                              <div className="text-white text-sm font-medium">{item.name}</div>
                              <div className="text-xs text-slate-400">
                                {item.type === 'gear' ? (
                                  <>
                                    {item.powMod !== 0 && <span className="text-orange-400">POW {item.powMod > 0 ? '+' : ''}{item.powMod} </span>}
                                    {item.spdMod !== 0 && <span className="text-yellow-400">SPD {item.spdMod > 0 ? '+' : ''}{item.spdMod} </span>}
                                    {item.maxHpMod !== 0 && <span className="text-red-400">HP +{item.maxHpMod}</span>}
                                  </>
                                ) : (
                                  <span className="text-purple-400">Consumable</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {item.type === 'gear' && (
                              <Button
                                onClick={() => equipFromBackpack(i)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                              >
                                Equip
                              </Button>
                            )}
                            {item.type === 'consumable' && item.healAmount > 0 && (
                              <Button
                                onClick={() => handleUseItem(i)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 bg-green-900/30 hover:bg-green-800/50"
                              >
                                Use
                              </Button>
                            )}
                            <Button
                              onClick={() => dropFromBackpack(i)}
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                            >
                              Drop
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-800/50 rounded-lg p-4 text-center text-slate-400 text-sm">
                      Backpack is empty
                    </div>
                  )}
                </div>

                <Button 
                  onClick={() => setBackpackOpen(false)}
                  variant="outline"
                  className="w-full bg-slate-700 hover:bg-slate-600"
                >
                  Close (I)
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fairy Quest Modal */}
        <AnimatePresence>
          {activeModal === 'fairy' && (() => {
            const gateData = POWERGATES[currentPowergate];
            const questGiver = gateData?.questGiver;
            const completedQuests = completedQuestsByGate[currentPowergate] || [];
            const availableQuests = gateData?.quests?.filter(q => !completedQuests.includes(q.id)) || [];
            const allQuestsComplete = availableQuests.length === 0;

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2"
                onClick={() => {
                  setActiveModal(null);
                  setQuestPanelOpen(false);
                }}
              >
                <motion.div
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.8, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 border-amber-700 rounded-xl shadow-2xl w-full overflow-hidden"
                  style={{ 
                    maxWidth: 'min(100vw - 16px, 520px)',
                    maxHeight: 'calc(100dvh - 16px)'
                  }}
                >
                  {/* Header */}
                  <div className="text-center p-4 border-b border-amber-800">
                    <div className="text-4xl mb-2">🧙</div>
                    <h2 className="text-2xl font-bold text-amber-300">{questGiver?.npcName || 'Quest Giver'}</h2>
                  </div>

                  {/* Body - Scrollable */}
                  <div className="bg-slate-900/50 rounded-lg m-4 p-3 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 220px)' }}>
                    {!questPanelOpen ? (
                      <div className="space-y-2 text-slate-200 text-xs leading-relaxed">
                        {questGiver?.openingDialogue?.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 text-slate-200 text-xs">
                        {activeQuest?.completed ? (
                          <>
                            <p className="text-green-400 font-medium">Quest Complete!</p>
                            <div className="bg-slate-800/50 rounded p-2 mb-3">
                              <div className="font-medium text-amber-300 mb-1 text-sm">{activeQuest.title}</div>
                              <div className="text-xs text-slate-400 mb-2">{activeQuest.description}</div>
                              <div className="text-xs text-green-400">✓ Completed</div>
                            </div>
                            <p className="text-slate-300">{questGiver?.questIntro || 'What else can I do for you?'}</p>
                          </>
                        ) : activeQuest && activeQuest.objective ? (
                          <>
                            <p className="text-slate-300">{questGiver?.questIntro || 'How goes your quest?'}</p>
                            <div className="mt-3 bg-slate-800/50 rounded p-2">
                              <div className="font-medium text-amber-300 mb-1 text-sm">{activeQuest.title}</div>
                              <div className="text-xs text-slate-400 mb-2">{activeQuest.description}</div>
                              <div className="flex items-center gap-2">
                                <Progress value={((activeQuest.progress || 0) / activeQuest.objective.count) * 100} className="flex-1 h-2" />
                                <span className="text-xs text-slate-300">{activeQuest.progress || 0}/{activeQuest.objective.count}</span>
                              </div>
                              {activeQuest.reward?.gold && (
                                <div className="text-xs text-amber-400 mt-1">Reward: {activeQuest.reward.gold} gold</div>
                              )}
                              {activeQuest.reward?.unlock && (
                                <div className="text-xs text-purple-400 mt-1">Reward: Unlock {activeQuest.reward.unlock}</div>
                              )}
                            </div>
                          </>
                        ) : allQuestsComplete ? (
                          <p className="text-slate-300">{questGiver?.questCompleteAllText || 'You have completed all available quests.'}</p>
                        ) : (
                          <>
                            <p className="text-slate-300">{questGiver?.questIntro || 'I have tasks for you.'}</p>
                            <div className="mt-3 bg-slate-800/50 rounded p-2">
                              <div className="font-medium text-amber-300 mb-1 text-sm">{availableQuests[0]?.title}</div>
                              <div className="text-xs text-slate-400 mb-2">{availableQuests[0]?.description}</div>
                              {availableQuests[0]?.reward?.gold && (
                                <div className="text-xs text-amber-400">Reward: {availableQuests[0].reward.gold} gold</div>
                              )}
                              {availableQuests[0]?.reward?.unlock && (
                                <div className="text-xs text-purple-400">Reward: Unlock {availableQuests[0].reward.unlock}</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 space-y-2 border-t border-amber-800">
                    {!questPanelOpen ? (
                      <Button 
                        onClick={() => setQuestPanelOpen(true)}
                        className="w-full bg-amber-700 hover:bg-amber-600 text-white text-sm h-9"
                      >
                        Quests
                      </Button>
                    ) : (
                      <>
                        {activeQuest?.completed ? (
                          <Button 
                          onClick={() => {
                            const reward = activeQuest.reward || {};

                            // Handle gold reward
                            if (reward.gold) {
                              setPlayer(p => ({ ...p, gold: p.gold + reward.gold }));
                              showMessage(`💰 Received ${reward.gold} gold!`, 'success');
                            }

                            // Handle unlock reward
                            if (reward.unlock) {
                              setPlayer(p => ({
                                ...p,
                                unlocks: { ...p.unlocks, [reward.unlock.toLowerCase()]: true }
                              }));
                              showMessage(`🎉 Unlocked: ${reward.unlock}!`, 'success');
                            }

                            const newCompletedQuests = [...(completedQuestsByGate[currentPowergate] || []), activeQuest.id];

                            setCompletedQuestsByGate(prevCompleted => ({
                              ...prevCompleted,
                              [currentPowergate]: newCompletedQuests
                            }));

                            setActiveQuest(null);

                            // Check if all quests for this powergate are now complete
                            const gateData = POWERGATES[currentPowergate];
                            const allQuestsInGate = gateData?.quests || [];
                            const allComplete = allQuestsInGate.length > 0 && allQuestsInGate.every(q => newCompletedQuests.includes(q.id));

                            if (allComplete && POWERGATES[currentPowergate + 1]) {
                              setTimeout(() => {
                                setCurrentPowergate(prev => prev + 1);
                                showMessage(`🔓 Powergate ${currentPowergate + 1} unlocked!`, 'success');
                              }, 500);
                            }
                          }}
                          className="w-full bg-green-700 hover:bg-green-600 text-white text-sm h-9"
                          >
                          Claim Reward
                          </Button>
                        ) : !activeQuest && !allQuestsComplete ? (
                          <Button 
                            onClick={() => {
                              if (availableQuests.length > 0) {
                                const quest = availableQuests[0];
                                setActiveQuest({ ...quest, progress: 0 });
                                showMessage(`📜 Quest Accepted: ${quest.title}`, 'success');
                                
                                // Handle TRAVEL_DISTANCE objective by tracking tiles revealed
                                if (quest.objective?.type === 'TRAVEL_DISTANCE') {
                                  // Progress tracked via TILES_REVEALED
                                }
                              }
                            }}
                            className="w-full bg-amber-700 hover:bg-amber-600 text-white text-sm h-9"
                          >
                            Accept Quest
                          </Button>
                        ) : null}
                        <Button 
                          onClick={() => setQuestPanelOpen(false)}
                          variant="outline"
                          className="w-full bg-slate-700 hover:bg-slate-600 text-sm h-9"
                        >
                          Back
                        </Button>
                      </>
                    )}
                    <Button 
                      onClick={() => {
                        setActiveModal(null);
                        setQuestPanelOpen(false);
                      }}
                      variant="outline"
                      className="w-full bg-slate-700 hover:bg-slate-600 text-sm h-9"
                    >
                      Farewell
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

      {/* Message Popup */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2"
            onClick={dismissMessage}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full rounded-xl shadow-2xl p-4 ${
                message.type === 'success' ? 'bg-gradient-to-br from-green-900/90 to-green-800/90 border-2 border-green-600' :
                message.type === 'error' ? 'bg-gradient-to-br from-red-900/90 to-red-800/90 border-2 border-red-600' :
                message.type === 'warning' ? 'bg-gradient-to-br from-orange-900/90 to-orange-800/90 border-2 border-orange-600' :
                'bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-2 border-slate-600'
              }`}
              style={{ 
                maxWidth: 'min(100vw - 16px, 400px)',
                maxHeight: 'calc(100dvh - 16px)'
              }}
            >
              <p className="text-white text-sm text-center font-medium leading-relaxed">
                {message.text}
              </p>
              <Button
                onClick={dismissMessage}
                className="w-full mt-3 bg-white/20 hover:bg-white/30 text-white border border-white/30 h-9 text-sm"
              >
                Continue
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inn Modal */}
      <AnimatePresence>
        {activeModal === 'inn' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-indigo-900/95 to-slate-900/95 border-2 border-indigo-700 rounded-xl shadow-2xl w-full overflow-hidden"
              style={{ 
                maxWidth: 'min(100vw - 16px, 400px)',
                maxHeight: 'calc(100dvh - 16px)'
              }}
            >
              <div className="text-center p-4 border-b border-indigo-800">
                <Moon className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
                <h2 className="text-2xl font-bold text-indigo-400 mb-1">The Inn</h2>
                <p className="text-slate-300 text-sm">Rest and restore your health</p>
              </div>

              <div className="p-4">
                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>Current HP:</span>
                    <span className="text-red-400">{player.hp}/{derivedStats.maxHp}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={useInn}
                    disabled={player.hp === derivedStats.maxHp}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-sm h-9"
                  >
                    Rest (Free)
                  </Button>
                  <Button 
                    onClick={() => setActiveModal(null)}
                    variant="outline"
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-sm h-9"
                  >
                    Leave
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bank Modal */}
      <AnimatePresence>
        {activeModal === 'bank' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-yellow-900/95 to-slate-900/95 border-2 border-yellow-700 rounded-xl shadow-2xl w-full overflow-hidden"
              style={{ 
                maxWidth: 'min(100vw - 16px, 400px)',
                maxHeight: 'calc(100dvh - 16px)'
              }}
            >
              <div className="text-center p-4 border-b border-yellow-800">
                <Coins className="w-12 h-12 mx-auto text-yellow-400 mb-2" />
                <h2 className="text-2xl font-bold text-yellow-400 mb-1">The Bank</h2>
                <p className="text-slate-300 text-sm">Store your gold safely</p>
              </div>

              <div className="p-4 space-y-3">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex justify-between text-slate-300 mb-2 text-sm">
                    <span>On Hand:</span>
                    <span className="text-yellow-400">{player.gold} gold</span>
                  </div>
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>In Bank:</span>
                    <span className="text-emerald-400">{player.bankGold} gold</span>
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    💡 Bank gold is safe even if you die
                  </p>
                </div>

                <div className="space-y-2">
                  <Button 
                    onClick={() => depositGold('all')}
                    disabled={player.gold === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm h-9"
                  >
                    Deposit All
                  </Button>
                  <Button 
                    onClick={() => withdrawGold('all')}
                    disabled={player.bankGold === 0}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-sm h-9"
                  >
                    Withdraw All
                  </Button>
                </div>

                <Button 
                  onClick={() => setActiveModal(null)}
                  variant="outline"
                  className="w-full bg-slate-700 hover:bg-slate-600 text-sm h-9"
                >
                  Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vault Modal */}
      <AnimatePresence>
        {activeModal === 'vault' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 border-slate-700 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="text-center mb-6">
                <Shield className="w-16 h-16 mx-auto text-slate-400 mb-3" />
                <h2 className="text-3xl font-bold text-slate-300 mb-2">The Vault</h2>
                <p className="text-slate-400 text-sm">Secure storage (8 slots, persists through death)</p>
              </div>

              {/* Vault Storage */}
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="text-white font-semibold mb-3">Vault Storage ({player.vaultItems.length}/8)</h3>
                {player.vaultItems.length > 0 ? (
                  <div className="space-y-2">
                    {player.vaultItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.emoji}</span>
                          <div>
                            <div className="text-white text-sm font-medium">{item.name}</div>
                            <div className="text-xs text-slate-400">
                              {item.type === 'gear' ? (
                                <>
                                  {item.powMod !== 0 && <span className="text-orange-400">POW {item.powMod > 0 ? '+' : ''}{item.powMod} </span>}
                                  {item.spdMod !== 0 && <span className="text-yellow-400">SPD {item.spdMod > 0 ? '+' : ''}{item.spdMod} </span>}
                                  {item.maxHpMod !== 0 && <span className="text-red-400">HP +{item.maxHpMod}</span>}
                                </>
                              ) : (
                                <span className="text-purple-400">Consumable</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            onClick={() => vaultToBackpack(i)}
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-xs px-2"
                          >
                            → Pack
                          </Button>
                          {item.type === 'gear' && (
                            <Button 
                              onClick={() => vaultToEquip(i)}
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs px-2"
                            >
                              Equip
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 text-sm py-4">
                    Vault is empty
                  </div>
                )}
              </div>

              {/* Equipment (deposit to vault) */}
              <div className="mb-4">
                <h3 className="text-white font-semibold mb-3">Your Equipment</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['weapon', 'armor', 'boots', 'magic'].map(slot => {
                    const item = player.equipment[slot];
                    return (
                      <div key={slot} className="bg-slate-800/50 rounded-lg p-2">
                        <div className="text-xs text-slate-400 mb-1 capitalize">{slot}</div>
                        {item ? (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-lg">{item.emoji}</span>
                              <div className="text-white text-xs font-medium truncate">{item.name}</div>
                            </div>
                            <Button
                              onClick={() => unequipToVault(slot)}
                              size="sm"
                              variant="outline"
                              className="w-full text-xs h-6"
                            >
                              Deposit
                            </Button>
                          </>
                        ) : (
                          <div className="text-slate-500 text-xs text-center py-2">Empty</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Backpack (deposit to vault) */}
              <div className="mb-4">
                <h3 className="text-white font-semibold mb-3">Your Backpack ({player.backpack.length}/{player.backpackCap})</h3>
                {player.backpack.length > 0 ? (
                  <div className="space-y-1">
                    {player.backpack.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{item.emoji}</span>
                          <span className="text-white text-xs">{item.name}</span>
                        </div>
                        <Button 
                          onClick={() => backpackToVault(i)}
                          size="sm" 
                          variant="outline" 
                          className="h-6 text-xs px-2"
                        >
                          Deposit
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 text-sm py-2 bg-slate-800/50 rounded">
                    Backpack is empty
                  </div>
                )}
              </div>
              
              <Button 
                onClick={() => setActiveModal(null)}
                variant="outline"
                className="w-full bg-slate-700 hover:bg-slate-600"
              >
                Leave Vault
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Modal */}
      <AnimatePresence>
        {activeModal === 'shop' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-emerald-900/95 to-slate-900/95 border-2 border-emerald-700 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="text-center mb-6">
                <ShoppingBag className="w-16 h-16 mx-auto text-emerald-400 mb-3" />
                <h2 className="text-3xl font-bold text-emerald-400 mb-2">The Shop</h2>
                <p className="text-slate-300">Gold: {player.gold}</p>
              </div>
              
              {/* Shop Items */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {shopItems.map((item, i) => (
                  <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-2xl">{item.emoji}</span>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium mb-1">{item.name}</div>
                        <Badge className={item.type === 'consumable' ? 'bg-blue-600 text-xs' : 'bg-slate-600 text-xs'}>
                          {item.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mb-2">
                      {item.powMod !== 0 && <div className="text-orange-400">POW {item.powMod > 0 ? '+' : ''}{item.powMod}</div>}
                      {item.spdMod !== 0 && <div className="text-yellow-400">SPD {item.spdMod > 0 ? '+' : ''}{item.spdMod}</div>}
                      {item.maxHpMod !== 0 && <div className="text-red-400">HP +{item.maxHpMod}</div>}
                      {item.usableInCombat && <div className="text-purple-400">⚔️ Combat Use</div>}
                    </div>
                    <Button 
                      onClick={() => buyItem(i)}
                      disabled={player.gold < item.cost}
                      size="sm"
                      className="w-full bg-amber-600 hover:bg-amber-700"
                    >
                      <Coins className="w-3 h-3 mr-1" />
                      Buy {item.cost}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Equipment (in Shop) */}
              <div className="mb-4">
                <h3 className="text-white font-semibold mb-3 text-sm">Your Equipment</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['weapon', 'armor', 'boots', 'magic'].map(slot => {
                    const item = player.equipment[slot];
                    return (
                      <div key={slot} className="bg-slate-800/50 rounded-lg p-2 flex items-center justify-between">
                        {item ? (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-lg">{item.emoji}</span>
                              <span className="text-white text-xs truncate">{item.name}</span>
                            </div>
                            <Button onClick={() => sellEquipped(slot)} size="sm" variant="outline" className="h-6 text-xs px-2">
                              Sell
                            </Button>
                          </>
                        ) : (
                          <span className="text-slate-500 text-xs capitalize">{slot}: Empty</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Backpack (in Shop) */}
              {player.backpack.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-white font-semibold mb-2 text-sm">Backpack ({player.backpack.length}/{player.backpackCap})</h3>
                  <div className="space-y-1">
                    {player.backpack.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                        <span className="text-white text-xs">{item.emoji} {item.name}</span>
                        <Button onClick={() => sellFromBackpack(i)} size="sm" variant="outline" className="h-6 text-xs px-2">
                          Sell {Math.floor(item.cost / 2)}g
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button 
                onClick={() => setActiveModal(null)}
                variant="outline"
                className="w-full bg-slate-700 hover:bg-slate-600"
              >
                Leave Shop
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Combat Modal */}
      <AnimatePresence>
        {combat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-gradient-to-br from-red-900/95 to-slate-900/95 border-2 border-red-700 rounded-xl shadow-2xl w-full"
              style={{ 
                maxWidth: 'min(100vw - 16px, 480px)'
              }}
            >
              {/* Monster */}
              <div className="text-center p-3 border-b border-red-800">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-3xl">{combat.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold text-red-400">{combat.name}</h2>
                    {!combat.canFlee && (
                      <Badge className="bg-red-800 text-red-200 border-red-600 text-[10px] px-1 py-0">
                        Cannot Flee
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-center mb-1">
                  <Heart className="w-3 h-3 text-red-400" />
                  <span className="text-white text-xs font-medium">{combat.hp}/{combat.maxHp}</span>
                  <Sword className="w-3 h-3 text-orange-400 ml-2" />
                  <span className="text-slate-300 text-xs">{combat.pow}</span>
                  <Zap className="w-3 h-3 text-yellow-400 ml-1" />
                  <span className="text-slate-300 text-xs">{combat.spd}</span>
                </div>
                <Progress value={(combat.hp / combat.maxHp) * 100} className="h-1.5 bg-slate-700 [&>div]:bg-red-500" />
              </div>

              {/* Player */}
              <div className="p-3 bg-slate-900/30 border-b border-red-900">
                <div className="flex items-center gap-2 justify-center mb-1">
                  <Heart className="w-3 h-3 text-red-400" />
                  <span className="text-white text-xs font-medium">You: {player.hp}/{derivedStats.maxHp}</span>
                  <Sword className="w-3 h-3 text-orange-400 ml-2" />
                  <span className="text-white text-xs">{derivedStats.pow}</span>
                  <Zap className="w-3 h-3 text-yellow-400 ml-1" />
                  <span className="text-white text-xs">{derivedStats.spd}</span>
                </div>
                <Progress value={(player.hp / derivedStats.maxHp) * 100} className="h-1.5 bg-slate-700 [&>div]:bg-emerald-500" />
              </div>

              {/* Message */}
              {combatMessage && (
                <div className="px-3 pt-2">
                  <div className="bg-slate-900/50 rounded p-2 text-center">
                    <p className="text-white text-xs leading-tight">{combatMessage}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-3 space-y-2">
                {/* Attack Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {getEquippedWeapon().map((weapon, i) => (
                    <Button
                      key={i}
                      onClick={() => attack(weapon.weaponAction)}
                      disabled={combatActionInProgress}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm h-11"
                    >
                      <span className="mr-1">{weapon.emoji}</span>
                      {weapon.name}
                    </Button>
                  ))}
                  {getEquippedWeapon().length === 0 && (
                    <Button
                      onClick={() => attack('punch')}
                      disabled={combatActionInProgress}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm h-11 col-span-2"
                    >
                      👊 Punch
                    </Button>
                  )}
                  {combat.canFlee && (
                    <Button 
                      onClick={flee}
                      disabled={combatActionInProgress}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm h-11"
                    >
                      <Footprints className="w-4 h-4 mr-1" />
                      Flee
                    </Button>
                  )}
                </div>

                {/* Consumables (max 4 visible) */}
                {player.backpack.filter(item => item.type === 'consumable' && item.usableInCombat).length > 0 && (
                  <div className="grid grid-cols-4 gap-1">
                    {player.backpack
                      .filter(item => item.type === 'consumable' && item.usableInCombat)
                      .slice(0, 4)
                      .map((item, i) => (
                        <Button
                          key={i}
                          onClick={() => useItemInCombat(player.backpack.indexOf(item))}
                          disabled={combatActionInProgress}
                          variant="outline"
                          className="bg-slate-800/50 border-slate-600 hover:bg-slate-700 h-11 px-1 flex flex-col items-center justify-center"
                        >
                          <span className="text-lg leading-none">{item.emoji}</span>
                          <span className="text-[9px] leading-tight mt-0.5">{item.name.split(' ')[0]}</span>
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tent Mailbox Modal */}
      <AnimatePresence>
        {mailboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2"
            onClick={() => setMailboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 border-slate-700 rounded-xl shadow-2xl w-full overflow-hidden"
              style={{ 
                maxWidth: 'min(100vw - 16px, 400px)',
                maxHeight: 'calc(100dvh - 16px)'
              }}
            >
              <div className="text-center p-4 border-b border-slate-700">
                <div className="text-4xl mb-2">📮</div>
                <h2 className="text-2xl font-bold text-slate-300">Mailbox</h2>
                <p className="text-slate-400 text-sm">Send items home by pigeon</p>
              </div>

              <div className="p-4 space-y-3">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="flex justify-between text-slate-300 text-sm">
                    <span>Gold on hand:</span>
                    <span className="text-yellow-400">{player.gold}</span>
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    depositGold('all');
                    showMessage('📮 Sent gold home by pigeon!', 'success');
                  }}
                  disabled={player.gold === 0}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-sm h-9"
                >
                  Send All Gold Home
                </Button>

                <div className="border-t border-slate-700 pt-3">
                  <h3 className="text-white text-sm font-semibold mb-2">Send Gear Home</h3>
                  {['weapon', 'armor', 'boots', 'magic'].map(slot => {
                    const item = player.equipment[slot];
                    return item ? (
                      <Button
                        key={slot}
                        onClick={() => {
                          unequipToVault(slot);
                          showMessage(`📮 Sent ${item.name} home!`, 'success');
                        }}
                        variant="outline"
                        className="w-full mb-2 text-xs h-8 justify-start"
                        disabled={player.vaultItems.length >= 8}
                      >
                        {item.emoji} {item.name}
                      </Button>
                    ) : null;
                  })}
                  {player.backpack.filter(i => i.type === 'gear').map((item, idx) => (
                    <Button
                      key={idx}
                      onClick={() => {
                        backpackToVault(player.backpack.indexOf(item));
                        showMessage(`📮 Sent ${item.name} home!`, 'success');
                      }}
                      variant="outline"
                      className="w-full mb-2 text-xs h-8 justify-start"
                      disabled={player.vaultItems.length >= 8}
                    >
                      {item.emoji} {item.name}
                    </Button>
                  ))}
                  {!player.equipment.weapon && !player.equipment.armor && !player.equipment.boots && !player.equipment.magic && player.backpack.filter(i => i.type === 'gear').length === 0 && (
                    <div className="text-slate-400 text-xs text-center py-2">No gear to send</div>
                  )}
                </div>

                <Button 
                  onClick={() => setMailboxOpen(false)}
                  variant="outline"
                  className="w-full bg-slate-700 hover:bg-slate-600 text-sm h-9"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop Modal */}
      <AnimatePresence>
        {dropModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-2 border-orange-700 rounded-xl shadow-2xl p-6 max-w-md w-full"
            >
              <h2 className="text-2xl font-bold text-orange-400 mb-4 text-center">Backpack Full!</h2>
              <p className="text-slate-300 text-sm mb-4 text-center">
                Choose an item to drop to make room for <span className="text-orange-400 font-semibold">{dropModal.pendingItem?.name}</span>
              </p>

              <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
                {player.backpack.map((item, i) => (
                  <Button
                    key={i}
                    onClick={() => handleDropChoice(i)}
                    variant="outline"
                    className="w-full bg-slate-800/50 hover:bg-slate-700 text-left justify-start h-auto py-2"
                  >
                    <span className="text-lg mr-2">{item.emoji}</span>
                    <span className="text-white text-sm">{item.name}</span>
                  </Button>
                ))}
              </div>

              <Button
                onClick={() => handleDropChoice(null)}
                variant="outline"
                className="w-full bg-red-700 hover:bg-red-600 text-white"
              >
                Drop {dropModal.pendingItem?.name}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}