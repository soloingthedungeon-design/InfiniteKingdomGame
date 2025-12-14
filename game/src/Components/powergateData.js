export const POWERGATES = {
  0: {
    name: "The Shallow Curse",
    questGiver: {
      npcName: "Harrow the Wayworn",
      openingDialogue: [
        "Wait? Who are you? I have been alone here for so long.",
        "Listen carefully, this world has sucumbed to a terrible curse. I know not who you are or why fate has brought you here to me, but I need your help! "
      ],
      questIntro: "Help me uncover the origin of this calamity",
      questCompleteAllText: "You've done what you can here. The curse is thinning around you. Find the next Powergate."
    },
    quests: [

        {
        id: "pg0_patchwork_map",
        title: "Shattered Reality",
        description: "Our once peaceful land has sucumbed to chaos. My magic keeps this village safe, but outside its bounds reality itself has shattered. every time you leave town, the land shifts, and changes! Go see for yourself! Take care not to get lost though you can see your minimap by clicking the map button on the bottom right of your screen! ",
        objective: { type: "TILES_REVEALED", count: 3 },
        reward: { gold: 10 }
      },
      {
        id: "pg0_scavenger",
        title: "Scavenger's Hands",
        description: "Not only has reality shifted but mysterious treasures are aprearing across the land! go find some and see what they contain, we need to learn all we can about this place.",
        objective: { type: "LOOT_COUNT", source: "TREASURE", zone: "OVERWORLD", count: 2 },
        reward: { gold: 8 }
      },

      {
        id: "pg0_supply_line",
        title: "Supply Line",
        description: "Ah, I see, those treasures will be very useful, you can also buy equiptment at the shop, and equipt it by clicking the backpack button on the top right of your screen . Go sell some treasure to the shop and buy some equiptment.",
        objective: { type: "SELL_ITEM", count: 1 },
        reward: { gold: 6 }
      },
      {
        id: "pg0_first_blood",
        title: "First Blood",
        description: "Now that you are properly equiped, see if you can handle the monsters outside of town!.",
        objective: { type: "KILL_COUNT", zone: "OVERWORLD", count: 1 },
        reward: { gold: 5 }
      },
      {
        id: "pg0_cave_peek",
        title: "A Taste of Dark",
        description: "Good, now that you are ready to handle the threats that lurk out in that choas, its time to go explore and learn more. mysterious caves have been apearing nearby, go find one and let me know what its like ",
        objective: { type: "ENTER_ZONE", zone: "CAVE", count: 1 },
        reward: { gold: 10 }
      },
      {
        id: "pg0_cave_hunt",
        title: "Cave Hunter",
        description: "Hmmm. Those caves are worrysome, maybe they hold the secret to this choas. Bring me back samples from the creatures that lurk in their bepths so we can learn more about this curse.",
        objective: { type: "KILL_COUNT", zone: "CAVE", count: 2 },
        reward: { gold: 12 }
      },
      
      
    ]
  },

  1: {
    name: "The Deeper Curse",
    questGiver: {
      npcName: "Harrow the Wayworn",
      openingDialogue: [
        "You survived the first trial. The curse loosens, but only slightly.",
        "The fog thickens beyond what you've explored. New paths reveal themselves.",
        "Prove you can endure what lies ahead."
      ],
      questIntro: "The next challenges await. Are you ready?",
      questCompleteAllText: "You've mastered this depth. Seek the next gate when you're ready."
    },

    quests: [
      {
        id: "pg1_ashen_hunt",
        title: "Hunt the Ashen Hound",
        description: "A grey predator stalks the plains at the edge of town. Bring it down before it learns your scent.",
        // flavor text kept inside description; schema stays compatible
        objective: { type: "KILL_COUNT", zone: "OVERWORLD", count: 3 },
        reward: { gold: 18 }
      },
      {
        id: "pg1_eyes_in_fog",
        title: "Eyes in the Fog",
        description: "Something watches from the swamp line. Drive it off before it draws worse things in.",
        objective: { type: "KILL_COUNT", zone: "OVERWORLD", count: 4 },
        reward: { gold: 20 }
      },
      {
        id: "pg1_rusted_blades",
        title: "Rusted Blades",
        description: "Scavengers ambush travelers in the roughlands. Thin them out.",
        objective: { type: "KILL_COUNT", zone: "OVERWORLD", count: 5 },
        reward: { gold: 24 }
      },
      {
        id: "pg1_supply_cache",
        title: "Supply Cache",
        description: "Stock up for deeper roads. Loot more treasure from the overworld.",
        objective: { type: "LOOT_COUNT", source: "TREASURE", zone: "OVERWORLD", count: 4 },
        reward: { gold: 22 }
      },
      {
        id: "pg1_cave_confidence",
        title: "Cave Confidence",
        description: "The caves are still deadly, but you can learn them. Win fights below the surface.",
        objective: { type: "KILL_COUNT", zone: "CAVE", count: 2 },
        reward: { gold: 26 }
      },
      {
        id: "pg1_second_lock",
        title: "Trial of the Second Lock",
        description: "Prove you're ready for the next gate: fight, loot, and return stronger.",
        objective: { type: "KILL_COUNT", zone: "OVERWORLD", count: 8 },
        reward: { gold: 0 }
      },
      {
        id: "pg1_final_tent",
        title: "Shelter on the Road",
        description: "You have learned to survive the land, but survival is not the same as endurance. Beyond these roads, distance itself becomes the enemy. Hunger. Wounds. Fatigue. Long ago, travelers learned a trick — not magic, but preparation. A shelter that follows you. A place to rest without returning home. Use it wisely. You will not be given a second.",
        objective: { type: "TRAVEL_DISTANCE", count: 18 },
        reward: { unlock: "TENT" }
      }
    ]
  }
};