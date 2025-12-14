// ============================================================================
// CONTENT PACK SYSTEM - Data-Driven Powergate Progression
// ============================================================================
// Powergates are the only world progression; worldPower removed.
// Merge mode: all tiers up to currentPowergate remain eligible.
// To add new content: Paste a new tier block into CONTENT_PACKS array below
// ============================================================================

// Hybrid weighting constants (tunable)
export const HYBRID_WEIGHTS = {
  overworldTiles: { latest: 0.30, previous: 0.70 },
  caveTiles: { latest: 0.50, previous: 0.50 },
  shopStock: { latest: 0.70, previous: 0.30 },
  questPool: { latest: 0.75, previous: 0.25 },
  groundLoot: { latest: 0.20, previous: 0.80 }
};

// ============================================================================
// CONTENT_PACKS: PASTE NEW TIERS HERE
// ============================================================================

export const CONTENT_PACKS = [
  // =========== TIER 0: BASE GAME ===========
  {
    tier: 0,
    minPowergate: 0,
    name: "Fogbound Wilderness",
    
    tiles: [
      { id: 'plains', name: 'Plains', bg: '#88cc88', border: '#6aaa6a', walkable: true, encounterChance: 0.05, 
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Grass2.png' },
      { id: 'rough', name: 'Rough', bg: '#8b7355', border: '#6b5335', walkable: true, encounterChance: 0.15,
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Rough2.png' },
      { id: 'swamp', name: 'Swamp', bg: '#2f6a4f', border: '#1f5a3f', walkable: true, encounterChance: 0.30,
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Tree2.png' },
      { id: 'blocked', name: 'Blocked', bg: '#555555', border: '#3a3a3a', walkable: false, encounterChance: 0,
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Blocked2.png' }
    ],
    
    caveTiles: [
      { id: 'cave_stone', name: 'Cave', bg: '#6a6a6a', border: '#4a4a4a', walkable: true, encounterChance: 0.35, 
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Cavefloor2.png' },
      { id: 'cave_chasm', name: 'Chasm', bg: '#0a0a0a', border: '#000000', walkable: false, encounterChance: 0 },
      { id: 'cave_lava', name: 'Lava', bg: '#cc3333', border: '#aa1111', walkable: false, encounterChance: 0,
      bgImage:  'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Lava2.png'  }
    ],
    
    monsters: [
      // Tier 1 (overworld starter)
      { id: 'field-mite', name: 'Field Mite', tier: 1, maxHp: 3, pow: 1, spd: 3, goldReward: 2, canFlee: true, emoji: '🪲', tileIds: ['plains', 'rough'] },
      { id: 'fog-gnat', name: 'Fog Gnat', tier: 1, maxHp: 4, pow: 1, spd: 4, goldReward: 2, canFlee: true, emoji: '🪰', tileIds: ['plains', 'rough'] },
      { id: 'scrap-rat', name: 'Scrap Rat', tier: 1, maxHp: 4, pow: 2, spd: 2, goldReward: 3, canFlee: true, emoji: '🐀', tileIds: ['plains', 'rough'] },
      { id: 'reed-snake', name: 'Reed Snake', tier: 1, maxHp: 5, pow: 2, spd: 3, goldReward: 3, canFlee: true, emoji: '🐍', tileIds: ['swamp', 'plains'] },
      // Tier 2
      { id: 'bog-spiderling', name: 'Bog Spiderling', tier: 2, maxHp: 6, pow: 2, spd: 4, goldReward: 4, canFlee: true, emoji: '🕷️', tileIds: ['swamp'] },
      { id: 'mud-goblin', name: 'Mud Goblin', tier: 2, maxHp: 7, pow: 3, spd: 3, goldReward: 5, canFlee: true, emoji: '👺', tileIds: ['swamp', 'rough'] },
      { id: 'lost-trapper', name: 'Lost Trapper', tier: 2, maxHp: 7, pow: 3, spd: 4, goldReward: 6, canFlee: true, emoji: '🪓', tileIds: ['plains', 'rough'] },
      { id: 'thorn-hare', name: 'Thorn Hare', tier: 2, maxHp: 6, pow: 3, spd: 5, goldReward: 5, canFlee: true, emoji: '🐇', tileIds: ['plains'] },
      // Tier 3
      { id: 'bone-sparrow', name: 'Bone Sparrow', tier: 3, maxHp: 8, pow: 3, spd: 5, goldReward: 7, canFlee: true, emoji: '🦴', tileIds: ['plains', 'rough'] },
      { id: 'bandit-cutthroat', name: 'Bandit Cutthroat', tier: 3, maxHp: 9, pow: 4, spd: 4, goldReward: 8, canFlee: true, emoji: '🗡️', tileIds: ['plains', 'rough'] },
      { id: 'mire-hound', name: 'Mire Hound', tier: 3, maxHp: 10, pow: 4, spd: 3, goldReward: 8, canFlee: true, emoji: '🐕', tileIds: ['swamp'] },
      { id: 'harpy-scrounger', name: 'Harpy Scrounger', tier: 3, maxHp: 9, pow: 3, spd: 6, goldReward: 8, canFlee: true, emoji: '🦅', tileIds: ['rough'] },
      
      // Tier 6 (cave monsters)
      { id: 'cave-stalker', name: 'Cave Stalker', tier: 6, maxHp: 18, pow: 6, spd: 4, goldReward: 18, canFlee: true, emoji: '🦇', tileIds: ['cave_stone'] },
      { id: 'stone-biter', name: 'Stone Biter', tier: 6, maxHp: 20, pow: 6, spd: 3, goldReward: 19, canFlee: true, emoji: '🪨', tileIds: ['cave_stone'] },
      { id: 'crypt-sentinel', name: 'Crypt Sentinel', tier: 6, maxHp: 22, pow: 6, spd: 2, goldReward: 20, canFlee: false, emoji: '🗿', tileIds: ['cave_stone'] },
      { id: 'fungal-thrall', name: 'Fungal Thrall', tier: 6, maxHp: 19, pow: 6, spd: 2, goldReward: 20, canFlee: true, emoji: '🍄', tileIds: ['cave_stone'] },
      

    ],
    
    items: [
      // Tier 1 gear
      { id: 'cloth-wrapped-club', name: 'Cloth-Wrapped Club', tier: 1, rarity: 'common', cost: 4, type: 'gear', slot: 'weapon', powMod: 1, spdMod: 0, maxHpMod: 0, weaponAction: 'slash', emoji: '🥖' },
      { id: 'rusty-dagger', name: 'Rusty Dagger', tier: 1, rarity: 'common', cost: 4, type: 'gear', slot: 'weapon', powMod: 1, spdMod: 1, maxHpMod: 0, weaponAction: 'quickstrike', emoji: '🗡️' },
      { id: 'patched-vest', name: 'Patched Vest', tier: 1, rarity: 'common', cost: 4, type: 'gear', slot: 'armor', powMod: 0, spdMod: 0, maxHpMod: 4, emoji: '🧥' },
      { id: 'trail-sandals', name: 'Trail Sandals', tier: 1, rarity: 'common', cost: 4, type: 'gear', slot: 'boots', powMod: 0, spdMod: 1, maxHpMod: 0, emoji: '🩴' },
      // Tier 2
      { id: 'iron-sword', name: 'Iron Sword', tier: 2, rarity: 'common', cost: 6, type: 'gear', slot: 'weapon', powMod: 2, spdMod: 0, maxHpMod: 0, weaponAction: 'slash', emoji: '⚔️' },
      { id: 'hunter-spear', name: 'Hunter Spear', tier: 2, rarity: 'common', cost: 6, type: 'gear', slot: 'weapon', powMod: 2, spdMod: 0, maxHpMod: 0, weaponAction: 'thrust', emoji: '🔱' },
      { id: 'leather-armor', name: 'Leather Armor', tier: 2, rarity: 'common', cost: 6, type: 'gear', slot: 'armor', powMod: 0, spdMod: 0, maxHpMod: 6, emoji: '🧥' },
      { id: 'runner-cloak', name: "Runner's Cloak", tier: 2, rarity: 'common', cost: 6, type: 'gear', slot: 'magic', powMod: 0, spdMod: 2, maxHpMod: 0, emoji: '🧣' },
      // Tier 3
      { id: 'balanced-saber', name: 'Balanced Saber', tier: 3, rarity: 'common', cost: 9, type: 'gear', slot: 'weapon', powMod: 3, spdMod: 1, maxHpMod: 0, weaponAction: 'slash', emoji: '🗡️' },
      { id: 'splitter-axe', name: 'Splitter Axe', tier: 3, rarity: 'common', cost: 9, type: 'gear', slot: 'weapon', powMod: 4, spdMod: -1, maxHpMod: 0, weaponAction: 'cleave', emoji: '🪓' },
      { id: 'round-shield', name: 'Round Shield', tier: 3, rarity: 'common', cost: 8, type: 'gear', slot: 'magic', powMod: 1, spdMod: 0, maxHpMod: 5, emoji: '🛡️' },
      { id: 'chain-shirt', name: 'Chain Shirt', tier: 3, rarity: 'common', cost: 10, type: 'gear', slot: 'armor', powMod: 0, spdMod: -1, maxHpMod: 9, emoji: '⛓️' },
      
      // Consumables
      { id: 'healing-herb', name: 'Healing Herb', tier: 1, rarity: 'common', cost: 4, type: 'consumable', usableInCombat: true, combatEffectType: 'heal', healAmount: 8, emoji: '🌿' },
      { id: 'health-potion', name: 'Health Potion', tier: 3, rarity: 'uncommon', cost: 8, type: 'consumable', usableInCombat: true, combatEffectType: 'heal', healAmount: 15, emoji: '🧪' },
      { id: 'greater-health-potion', name: 'Greater Health Potion', tier: 6, rarity: 'rare', cost: 16, type: 'consumable', usableInCombat: true, combatEffectType: 'heal', healAmount: 28, emoji: '🧪' },
      { id: 'rune-stone', name: 'Rune Stone', tier: 2, rarity: 'uncommon', cost: 6, type: 'consumable', usableInCombat: true, combatEffectType: 'autoFlee', emoji: '🗿' },
      { id: 'smoke-bomb', name: 'Smoke Bomb', tier: 4, rarity: 'uncommon', cost: 10, type: 'consumable', usableInCombat: true, combatEffectType: 'autoFlee', emoji: '💨' }
    ],
    
    treasures: [
      { id: 'gold-small', type: 'gold', min: 2, max: 6, weight: 60, tileIds: ['plains', 'rough', 'swamp'] },
      { id: 'gold-medium', type: 'gold', min: 6, max: 10, weight: 5, tileIds: ['plains', 'rough', 'swamp'] },
      { id: 'herb-drop', type: 'item', itemId: 'healing-herb', weight: 25, tileIds: ['plains', 'rough', 'swamp'] },
      { id: 'rune-drop', type: 'item', itemId: 'rune-stone', weight: 10, tileIds: ['plains', 'rough', 'swamp'] },
      { id: 'cave-gold-small', type: 'gold', min: 8, max: 16, weight: 45, tileIds: ['cave_stone'] },
      { id: 'cave-gold-medium', type: 'gold', min: 16, max: 30, weight: 5, tileIds: ['cave_stone'] },
      { id: 'cave-herb', type: 'item', itemId: 'healing-herb', weight: 15, tileIds: ['cave_stone'] },
      { id: 'cave-potion', type: 'item', itemId: 'health-potion', weight: 20, tileIds: ['cave_stone'] },
      { id: 'cave-greater-potion', type: 'item', itemId: 'greater-health-potion', weight: 3, tileIds: ['cave_stone'] },
      { id: 'cave-smoke', type: 'item', itemId: 'smoke-bomb', weight: 7, tileIds: ['cave_stone'] }
    ],
    
  },
  
  // =========== TIER 1: GATE 1 ADDITIONS ===========
  {
    tier: 1,
    minPowergate: 1,
    name: "Fogbound Wilderness: Gate 1",

    tiles: [
      { id: 'plains1', name: 'Plains', bg: '#88cc88', border: '#6aaa6a', walkable: true, encounterChance: 0.05, 
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Grass2.png' },
      { id: 'rough1', name: 'Rough', bg: '#8b7355', border: '#6b5335', walkable: true, encounterChance: 0.15,
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Rough2.png' },
      { id: 'swamp1', name: 'Swamp', bg: '#2f6a4f', border: '#1f5a3f', walkable: true, encounterChance: 0.30,
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Tree2.png' },
      { id: 'blocked1', name: 'Blocked', bg: '#555555', border: '#3a3a3a', walkable: false, encounterChance: 0,
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Tree3.png' }
    ],
    
    caveTiles: [
      { id: 'cave_stone1', name: 'Cave', bg: '#6a6a6a', border: '#4a4a4a', walkable: true, encounterChance: 0.35, 
        bgImage: 'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Cavefloor2.png' },
      { id: 'cave_chasm1', name: 'Chasm', bg: '#0a0a0a', border: '#000000', walkable: false, encounterChance: 0 },
      { id: 'cave_lava1', name: 'Lava', bg: '#cc3333', border: '#aa1111', walkable: false, encounterChance: 0 ,
        bgImage:  'https://raw.githubusercontent.com/soloingthedungeon-design/InfiniteKingdom/refs/heads/main/Lava2.png' 
}
    ],
  
    monsters: [
      { id: 'ashen-hound', name: 'Ashen Hound', tier: 4, maxHp: 12, pow: 5, spd: 4, goldReward: 9, canFlee: true, emoji: '🐺', tileIds: ['plains1', 'rough1'] },
      { id: 'fog-stalker', name: 'Fog Stalker', tier: 4, maxHp: 11, pow: 4, spd: 6, goldReward: 9, canFlee: true, emoji: '👁️', tileIds: ['plains1', 'swamp1'] },
      { id: 'rusted-marauder', name: 'Rusted Marauder', tier: 4, maxHp: 13, pow: 5, spd: 3, goldReward: 10, canFlee: true, emoji: '🪓', tileIds: ['rough1'] },
      { id: 'thornback-boar', name: 'Thornback Boar', tier: 5, maxHp: 15, pow: 5, spd: 3, goldReward: 11, canFlee: true, emoji: '🐗', tileIds: ['plains1'] },
      { id: 'swamp-lurker', name: 'Swamp Lurker', tier: 5, maxHp: 14, pow: 5, spd: 4, goldReward: 11, canFlee: true, emoji: '🐊', tileIds: ['swamp1'] }
    ],

    items: [
      { id: 'iron-cleaver', name: 'Iron Cleaver', tier: 4, rarity: 'common', cost: 12, type: 'gear', slot: 'weapon', powMod: 3, spdMod: -1, maxHpMod: 0, weaponAction: 'cleave', emoji: '🪓' },
      { id: 'fog-etched-blade', name: 'Fog-Etched Blade', tier: 4, rarity: 'common', cost: 13, type: 'gear', slot: 'weapon', powMod: 2, spdMod: 1, maxHpMod: 0, weaponAction: 'slash', emoji: '🗡️' },
      { id: 'reinforced-jerkin', name: 'Reinforced Jerkin', tier: 4, rarity: 'common', cost: 14, type: 'gear', slot: 'armor', powMod: 0, spdMod: 0, maxHpMod: 12, emoji: '🧥' },
      { id: 'pathfinder-boots', name: 'Pathfinder Boots', tier: 4, rarity: 'common', cost: 12, type: 'gear', slot: 'boots', powMod: 0, spdMod: 2, maxHpMod: 0, emoji: '🥾' },
      { id: 'stout-health-potion', name: 'Stout Health Potion', tier: 4, rarity: 'uncommon', cost: 14, type: 'consumable', usableInCombat: true, combatEffectType: 'heal', healAmount: 20, emoji: '🧪' }
    ],

    treasures: [
      { id: 'g1-gold-small', type: 'gold', min: 6, max: 12, weight: 40, tileIds: ['plains', 'rough', 'swamp', 'plains1', 'rough1', 'swamp1'] },
      { id: 'g1-gold-medium', type: 'gold', min: 12, max: 20, weight: 8, tileIds: ['plains', 'rough', 'swamp', 'plains1', 'rough1', 'swamp1'] },
      { id: 'g1-herb-drop', type: 'item', itemId: 'healing-herb', weight: 20, tileIds: ['plains', 'rough', 'swamp', 'plains1', 'rough1', 'swamp1'] },
      { id: 'g1-stout-potion', type: 'item', itemId: 'stout-health-potion', weight: 10, tileIds: ['plains', 'rough', 'swamp', 'plains1', 'rough1', 'swamp1'] },

      { id: 'g1-cave-gold', type: 'gold', min: 14, max: 28, weight: 35, tileIds: ['cave_stone', 'cave_stone1'] },
      { id: 'g1-cave-potion', type: 'item', itemId: 'health-potion', weight: 18, tileIds: ['cave_stone', 'cave_stone1'] },
      { id: 'g1-cave-smoke', type: 'item', itemId: 'smoke-bomb', weight: 8, tileIds: ['cave_stone', 'cave_stone1'] }
    ],
  }

];

// ============================================================================
// POWERGATE-BASED TIER RESOLUTION (MERGE MODE)
// ============================================================================
// Powergates are the only world progression; worldPower removed.
// Merge mode: all tiers up to currentPowergate remain eligible.

export function getActiveTier(currentPowergate) {
  let activeTier = 0;
  
  for (const pack of CONTENT_PACKS) {
    if (currentPowergate >= pack.minPowergate) {
      activeTier = Math.max(activeTier, pack.tier);
    }
  }
  
  return activeTier;
}

// ============================================================================
// CONTENT MERGE & BUILD (MERGE MODE)
// ============================================================================
// Merge mode: all tiers up to currentPowergate remain eligible.

export function buildGameContentForPlayer(player, currentPowergate = 0) {
  const activeTier = getActiveTier(currentPowergate);
  
  // Dictionaries: merge all unlocked packs (MERGE MODE: all gates 0..currentPowergate)
  const tiles = {};
  const caveTiles = {};
  const monsters = {};
  const items = {};
  const treasures = {};

  
  const availablePacks = CONTENT_PACKS.filter(pack => pack.minPowergate <= currentPowergate);
  
  for (const pack of availablePacks) {
    pack.tiles?.forEach(t => { tiles[t.id] = t; });
    pack.caveTiles?.forEach(t => { caveTiles[t.id] = t; });
    pack.monsters?.forEach(m => { monsters[m.id] = m; });
    pack.items?.forEach(i => { items[i.id] = i; });
    pack.treasures?.forEach(tr => { treasures[tr.id] = tr; });
  }
  
  // Build spawn tables with hybrid weighting
  const spawn = {
    overworldTiles: buildHybridTable(availablePacks, activeTier, p => p.tiles, HYBRID_WEIGHTS.overworldTiles),
    caveTiles: buildHybridTable(availablePacks, activeTier, p => p.caveTiles, HYBRID_WEIGHTS.caveTiles),
    shopStock: buildHybridTable(availablePacks, activeTier, p => p.items, HYBRID_WEIGHTS.shopStock),
    monstersByTile: buildMonstersByTileTable(availablePacks, activeTier, monsters),
    groundLootByTile: buildGroundLootByTileTable(availablePacks, activeTier, treasures)
  };
  
  return {
    meta: { currentPowergate, activeTier },
    tiles,
    caveTiles,
    monsters,
    items,
    treasures,
    spawn
  };
}

function buildHybridTable(packs, activeTier, extractFunc, weights) {
  const latestPack = packs.find(p => p.tier === activeTier);
  const previousPacks = packs.filter(p => p.tier < activeTier);
  
  const latest = extractFunc(latestPack) || [];
  const previous = previousPacks.flatMap(p => extractFunc(p) || []);
  
  const latestTable = latest.map(item => ({ id: item.id, w: weights.latest }));
  const previousTable = previous.map(item => ({ id: item.id, w: weights.previous / Math.max(1, previous.length) }));
  
  return [...latestTable, ...previousTable];
}

function buildMonstersByTileTable(packs, activeTier, monstersDict) {
  const byTile = {};
  
  for (const monsterId in monstersDict) {
    const monster = monstersDict[monsterId];
    const tileIds = monster.tileIds || [];
    
    for (const tileId of tileIds) {
      if (!byTile[tileId]) byTile[tileId] = [];
      
      // Weight by tier (higher tier = higher weight if from active tier)
      const isLatest = monster.tier === activeTier;
      const weight = isLatest ? HYBRID_WEIGHTS.groundLoot.latest : (HYBRID_WEIGHTS.groundLoot.previous / 10);
      
      byTile[tileId].push({ id: monsterId, w: weight });
    }
  }
  
  return byTile;
}

function buildGroundLootByTileTable(packs, activeTier /*, treasuresDict */) {
  // 1) Find the highest eligible pack (<= activeTier) that has treasures
  const eligible = packs
    .filter(p => p.tier <= activeTier && Array.isArray(p.treasures) && p.treasures.length > 0)
    .sort((a, b) => b.tier - a.tier);

  const pack = eligible[0];

  // If nothing eligible, return empty table
  if (!pack) return {};

  // 2) Build byTile from ONLY that pack’s treasure table
  const byTile = {};

  for (const treasure of pack.treasures) {
    const tileIds = treasure.tileIds || [];
    for (const tileId of tileIds) {
      if (!byTile[tileId]) byTile[tileId] = [];
      byTile[tileId].push({ id: treasure.id, w: treasure.weight });
    }
  }

  return byTile;
}

// ============================================================================
// WEIGHTED RANDOM SELECTION
// ============================================================================

function weightedPick(table, rng01) {
  if (!table || !Array.isArray(table) || table.length === 0) return null;
  
  const totalWeight = table.reduce((sum, entry) => {
    const w = typeof entry.w === 'number' && !isNaN(entry.w) ? entry.w : 0;
    return sum + w;
  }, 0);
  
  if (totalWeight <= 0) return table[0]?.id || null;
  
  let roll = rng01() * totalWeight;
  
  for (const entry of table) {
    const w = typeof entry.w === 'number' && !isNaN(entry.w) ? entry.w : 0;
    roll -= w;
    if (roll <= 0) return entry.id;
  }
  
  return table[table.length - 1]?.id || null;
}

// ============================================================================
// CONTENT PICK FUNCTIONS
// ============================================================================

export function pickOverworldTileId(content, rng01 = Math.random) {
  return weightedPick(content.spawn.overworldTiles, rng01);
}

export function pickCaveTileId(content, rng01 = Math.random) {
  return weightedPick(content.spawn.caveTiles, rng01);
}

export function pickMonsterForTile(content, tileId, rng01 = Math.random) {
  const table = content.spawn.monstersByTile[tileId] || [];
  const monsterId = weightedPick(table, rng01);
  
  if (!monsterId) return null;
  
  const monsterTemplate = content.monsters[monsterId];
  if (!monsterTemplate) return null;
  
  // Clone and initialize hp
  return {
    ...monsterTemplate,
    hp: monsterTemplate.maxHp
  };
}

export function pickGroundLootForTile(content, tileId, rng01 = Math.random) {
  const table = content.spawn.groundLootByTile[tileId];
  
  // Safety: no table for this tile
  if (!table || !Array.isArray(table) || table.length === 0) {
    return { type: 'gold', amount: 1 }; // Fallback: 1 gold
  }
  
  const treasureId = weightedPick(table, rng01);
  if (!treasureId) return { type: 'gold', amount: 1 };
  
  const treasure = content.treasures[treasureId];
  if (!treasure) return { type: 'gold', amount: 1 };
  
  // Roll treasure result
  if (treasure.type === 'gold') {
    const amount = Math.floor(rng01() * (treasure.max - treasure.min + 1)) + treasure.min;
    return { type: 'gold', amount };
  } else if (treasure.type === 'item' && treasure.itemId) {
    const item = content.items[treasure.itemId];
    if (!item) return { type: 'gold', amount: 2 }; // Item not found, give gold
    return { type: 'item', item };
  }
  
  return { type: 'gold', amount: 1 };
}

export function pickShopItemId(content, rng01 = Math.random) {
  return weightedPick(content.spawn.shopStock, rng01);
}

export function pickQuestId(content, rng01 = Math.random) {
  return weightedPick(content.spawn.questPool, rng01);
}

// ============================================================================
// HELPERS
// ============================================================================

export function getTileById(content, tileId) {
  return content.tiles[tileId] || content.caveTiles[tileId] || null;
}

export function getItemById(content, itemId) {
  return content.items[itemId] || null;
}