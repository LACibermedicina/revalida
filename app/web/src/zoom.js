// Zoom do sistema (funções puras).
export const PASSOS = [60, 70, 80, 90, 100, 110, 120, 130];
/** Escala automática: janela de desktop estreita (700–1100 px) encolhe até 65% para caber a largura de projeto; celular usa o layout próprio. */
export const escalaAuto = (largura, projeto = 1100) => (largura >= 700 && largura < projeto ? Math.max(0.65, Math.round((largura / projeto) * 100) / 100) : 1);
