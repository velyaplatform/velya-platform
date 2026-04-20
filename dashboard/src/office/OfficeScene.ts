import Phaser from 'phaser';
import {
  CHARACTER_NAMES, MALE_CHARACTERS, FEMALE_CHARACTERS, avatarKeys, avatarPath,
  DESK_PATHS,
  FURNITURE_PATHS,
  type CharacterName,
} from './assetKeys';
import { CELL_W, CELL_H, MARGIN, WALL_H } from './palette';
import { AgentSprite } from './AgentSprite';
import type { RoomData, RoomAgent } from '@/lib/buildActiveRooms';
import type { Product } from '@/types/company';
import type { Agent } from '@/types/state';

const PRODUCT_LABEL: Record<Product, string> = {
  hospitalar: 'VELYA HOSPITALAR',
  lince: 'LINCE SOC',
  shared: 'COMPARTILHADO',
};

const PRODUCT_COLOR: Record<Product, string> = {
  hospitalar: '#0ea5e9',
  lince: '#ef4444',
  shared: '#64748b',
};

function assignCharacters(agents: RoomAgent[]): Map<string, CharacterName> {
  const map = new Map<string, CharacterName>();
  let m = 0, f = 0;
  for (const a of agents) {
    if (a.gender === 'male') {
      map.set(a.id, MALE_CHARACTERS[m % MALE_CHARACTERS.length]);
      m++;
    } else {
      map.set(a.id, FEMALE_CHARACTERS[f % FEMALE_CHARACTERS.length]);
      f++;
    }
  }
  return map;
}

export class OfficeScene extends Phaser.Scene {
  private agentSprites: Map<string, AgentSprite> = new Map();

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
    for (const [key, path] of Object.entries(DESK_PATHS)) {
      this.load.image(key, path);
    }
    for (const name of CHARACTER_NAMES) {
      const keys = avatarKeys(name);
      this.load.image(keys.blink, avatarPath(name, 'blink'));
      this.load.image(keys.talk, avatarPath(name, 'talk'));
      this.load.image(keys.wave1, avatarPath(name, 'wave1'));
      this.load.image(keys.wave2, avatarPath(name, 'wave2'));
    }
    for (const [key, path] of Object.entries(FURNITURE_PATHS)) {
      this.load.image(key, path);
    }
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('Failed to load asset:', file.key, file.url);
    });
  }

  create(): void {
    this.textures.list && Object.values(this.textures.list).forEach((tex) => {
      if (tex.key !== '__DEFAULT' && tex.key !== '__MISSING') {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    this.events.on('roomsUpdate', (rooms: RoomData[]) => {
      this.renderRooms(rooms);
    });

    this.renderRooms([]);
  }

  private renderRooms(rooms: RoomData[]): void {
    this.clearScene();

    if (rooms.length === 0) {
      this.renderEmptyState();
      return;
    }

    const cellW = CELL_W + 64;
    const cellH = CELL_H + 80;
    const loungeSpace = 48;
    const roomGap = 40;
    const roomLabelH = 60;

    const roomLayouts = rooms.map((r) => {
      let maxCol = 1, maxRow = 1;
      for (const a of r.agents) {
        maxCol = Math.max(maxCol, a.col);
        maxRow = Math.max(maxRow, a.row);
      }
      const roomW = Math.max(maxCol * cellW + MARGIN * 2, 580);
      const roomH = maxRow * cellH + MARGIN * 2 + WALL_H + loungeSpace;
      return { room: r, roomW, roomH, x: 0, y: roomLabelH };
    });

    let cursorX = 0;
    let maxRoomH = 0;
    for (const layout of roomLayouts) {
      layout.x = cursorX;
      cursorX += layout.roomW + roomGap;
      maxRoomH = Math.max(maxRoomH, layout.roomH);
    }
    const totalW = Math.max(cursorX - roomGap, 600);
    const totalH = maxRoomH + roomLabelH;

    for (const layout of roomLayouts) {
      this.renderSingleRoom(layout);
    }

    const cam = this.cameras.main;
    const scaleX = cam.width / (totalW + 48);
    const scaleY = cam.height / (totalH + 48);
    const zoom = Math.min(scaleX, scaleY, 2);
    cam.setZoom(zoom);
    cam.centerOn(totalW / 2, totalH / 2);
  }

  private renderSingleRoom(layout: {
    room: RoomData;
    roomW: number;
    roomH: number;
    x: number;
    y: number;
  }): void {
    const { room, roomW, roomH, x, y } = layout;
    const cellW = CELL_W + 64;
    const cellH = CELL_H + 80;

    this.drawRoomAtOffset(x, y, roomW, roomH, room.product);
    this.drawRoomLabel(x, y - 40, roomW, room);

    const characterMap = assignCharacters(room.agents);
    for (let i = 0; i < room.agents.length; i++) {
      const a = room.agents[i];
      const ax = x + (a.col - 1) * cellW + MARGIN + cellW / 2;
      const ay = y + (a.row - 1) * cellH + MARGIN + WALL_H + cellH / 2;
      const characterName = characterMap.get(a.id)!;
      const deskVariant = i % 2 === 0 ? 'black' : 'white';

      const compatAgent: Agent = {
        id: a.id,
        name: a.displayName,
        icon: '',
        status: a.status,
        gender: a.gender,
        desk: { col: a.col, row: a.row },
      };

      const sprite = new AgentSprite(this, ax, ay, characterName, deskVariant, compatAgent);
      if (a.task) {
        sprite.showTaskBubble(a.task);
      }
      this.agentSprites.set(a.id, sprite);
    }
  }

  private drawRoomAtOffset(
    ox: number,
    oy: number,
    roomW: number,
    roomH: number,
    product: Product,
  ): void {
    const productHex = parseInt(PRODUCT_COLOR[product].slice(1), 16);
    const g = this.add.graphics();
    g.fillStyle(0xd9cfc2, 1);
    g.fillRect(ox, oy + WALL_H, roomW, roomH - WALL_H);
    g.fillStyle(0xc5b9a8, 0.25);
    const TILE = 32;
    for (let yy = WALL_H; yy < roomH; yy += TILE) {
      for (let xx = 0; xx < roomW; xx += TILE) {
        if ((xx / TILE + yy / TILE) % 2 === 0) {
          g.fillRect(ox + xx, oy + yy, TILE, TILE);
        }
      }
    }
    g.fillStyle(0xe6dcc8, 1);
    g.fillRect(ox, oy, roomW, WALL_H);
    g.fillStyle(0xede2d6, 1);
    g.fillRect(ox, oy, roomW, WALL_H / 3);
    g.fillStyle(0xb8a690, 1);
    g.fillRect(ox, oy + WALL_H - 5, roomW, 5);
    g.lineStyle(3, productHex, 0.9);
    g.strokeRect(ox, oy, roomW, roomH);
    g.setDepth(-1);
  }

  private drawRoomLabel(x: number, y: number, roomW: number, room: RoomData): void {
    const productColor = PRODUCT_COLOR[room.product];
    const productHex = parseInt(productColor.slice(1), 16);
    const g = this.add.graphics();
    const labelW = Math.min(roomW - 20, 480);
    g.fillStyle(0x1a1225, 0.95);
    g.fillRoundedRect(x + 10, y, labelW, 34, 6);
    g.lineStyle(1.5, productHex, 0.9);
    g.strokeRoundedRect(x + 10, y, labelW, 34, 6);
    g.setDepth(950);

    this.add.text(x + 22, y + 9, PRODUCT_LABEL[room.product], {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: productColor,
    }).setOrigin(0, 0).setDepth(951);

    this.add.text(x + 22 + 110, y + 8, room.name, {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0, 0).setDepth(951);

    const workingCount = room.agents.filter((a) => a.status === 'working').length;
    this.add.text(x + 10 + labelW - 10, y + 10, `${workingCount}/${room.agents.length} ativos`, {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: '11px',
      color: '#a0a0a8',
    }).setOrigin(1, 0).setDepth(951);
  }

  private renderEmptyState(): void {
    const cam = this.cameras.main;
    cam.setZoom(1);
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    cam.centerOn(cx, cy);

    this.add.text(cx, cy - 20, 'Nenhuma ala em operação no momento', {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#e5e5ea',
    }).setOrigin(0.5, 0.5);

    this.add.text(cx, cy + 12, 'Rode uma ala Opensquad ou registre uma delegação em .claude/ledger/delegations.jsonl', {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: '12px',
      color: '#8a8a92',
    }).setOrigin(0.5, 0.5);
  }

  private clearScene(): void {
    for (const sprite of this.agentSprites.values()) {
      sprite.destroy();
    }
    this.agentSprites.clear();
    this.children.removeAll(true);
  }
}
