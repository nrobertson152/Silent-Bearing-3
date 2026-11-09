// Simple procedural national emblems as inline SVG.

import type { NationId } from '../data/types';

export function flagSvg(n: NationId, h = 24): string {
  const w = Math.round(h * 1.5);
  const body = FLAGS[n] ?? FLAGS.nl;
  return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">${body}<rect x="0.25" y="0.25" width="29.5" height="19.5" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="0.5"/></svg>`;
}

function usFlag(): string {
  let s = '';
  for (let i = 0; i < 13; i++) s += `<rect x="0" y="${(i * 20) / 13}" width="30" height="${20 / 13 + 0.02}" fill="${i % 2 ? '#f4f1ea' : '#b22234'}"/>`;
  s += '<rect x="0" y="0" width="12" height="10.77" fill="#3c3b6e"/>';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) s += `<circle cx="${0.9 + c * 1.45}" cy="${0.95 + r * 1.78}" r="0.35" fill="#f4f1ea"/>`;
  return s;
}

function unionJack(x: number, y: number, w: number, h: number): string {
  return `<g transform="translate(${x},${y}) scale(${w / 60},${h / 30})">
    <rect width="60" height="30" fill="#012169"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" stroke-width="2"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6"/></g>`;
}

const FLAGS: Record<NationId, string> = {
  us: usFlag(),
  uk: `<rect width="30" height="20" fill="#f4f1ea"/><path d="M15,0 v20 M0,10 h30" stroke="#c8102e" stroke-width="3"/>${unionJack(0, 0, 15, 10)}`,
  de: `<rect width="30" height="20" fill="#6f777c"/><path d="M15,3 v14 M8,10 h14" stroke="#f4f1ea" stroke-width="5"/><path d="M15,3.8 v12.4 M8.8,10 h12.4" stroke="#111" stroke-width="3"/>`,
  jp: '<rect width="30" height="20" fill="#f4f1ea"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>',
  it: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#f4f1ea"/><rect x="20" width="10" height="20" fill="#ce2b37"/>',
  nl: '<rect width="30" height="6.67" fill="#ae1c28"/><rect y="6.67" width="30" height="6.67" fill="#f4f1ea"/><rect y="13.33" width="30" height="6.67" fill="#21468b"/>',
};
