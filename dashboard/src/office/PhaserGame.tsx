import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from './OfficeScene';
import { useSquadStore } from '@/store/useSquadStore';
import { buildActiveRooms } from '@/lib/buildActiveRooms';

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: w,
      height: h,
      pixelArt: false,
      antialias: false,
      roundPixels: true,
      backgroundColor: '#1a1420',
      scene: [OfficeScene],
      scale: { mode: Phaser.Scale.NONE },
    });
    gameRef.current = game;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) game.scale.resize(width, height);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    let detach: (() => void) | null = null;
    const interval = window.setInterval(() => {
      const game = gameRef.current;
      const scene = game?.scene.getScene("OfficeScene") as OfficeScene | null;
      if (!scene?.scene.isActive()) return;
      const onSelect = (agentId: string) => {
        useSquadStore.getState().selectAgent(agentId);
      };
      scene.events.on("agentSelected", onSelect);
      detach = () => scene.events.off("agentSelected", onSelect);
      window.clearInterval(interval);
    }, 100);

    return () => {
      window.clearInterval(interval);
      detach?.();
    };
  }, []);

  // Bridge store → Phaser: envia salas ativas (opensquad + engenharia via ledger)
  useEffect(() => {
    const emit = () => {
      const game = gameRef.current;
      if (!game) return;
      const scene = game.scene.getScene('OfficeScene') as OfficeScene | null;
      if (!scene || !scene.scene.isActive()) return;
      const state = useSquadStore.getState();
      const rooms = buildActiveRooms({
        company: state.company,
        activeStates: state.activeStates,
        delegations: state.delegations,
        handoffs: state.handoffs,
      });
      scene.events.emit('roomsUpdate', rooms);
    };

    // Emite inicial assim que a scene estiver pronta
    const t = setInterval(() => {
      const game = gameRef.current;
      const scene = game?.scene.getScene('OfficeScene') as OfficeScene | null;
      if (scene?.scene.isActive()) {
        emit();
        clearInterval(t);
      }
    }, 100);

    const unsub = useSquadStore.subscribe(emit);
    return () => {
      clearInterval(t);
      unsub();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        imageRendering: 'auto',
      }}
    />
  );
}
