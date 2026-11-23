import { dataLocal, diasAte, formatarDataBR } from './datas';

// Rodar em fusos diferentes:  TZ=America/Manaus CI=true npx react-scripts test --watchAll=false
const API = '2026-11-23T00:00:00.000Z'; // como a API serializa uma coluna DATE

test('dataLocal lê o dia do calendário, sem deslocar pelo fuso', () => {
  const d = dataLocal(API);
  expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 11, 23]);
  expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  const so = dataLocal('2026-11-23');
  expect([so.getFullYear(), so.getMonth() + 1, so.getDate()]).toEqual([2026, 11, 23]);
});

test('vence hoje: 0 dias, e só vira vencido (negativo) no dia seguinte', () => {
  const hojeManha = new Date(2026, 10, 23, 9, 14, 40); // 23/11/2026 09:14, hora local
  const hojeNoite = new Date(2026, 10, 23, 23, 59, 0);
  const amanha = new Date(2026, 10, 24, 0, 1, 0);
  expect(diasAte(API, hojeManha)).toBe(0); // "HOJE", não "VENCIDO"
  expect(diasAte(API, hojeNoite)).toBe(0);
  expect(diasAte(API, amanha)).toBe(-1); // agora sim vencido
});

test('dias restantes antes do vencimento', () => {
  expect(diasAte(API, new Date(2026, 10, 20, 8, 0, 0))).toBe(3);
  expect(diasAte(API, new Date(2026, 10, 22, 8, 0, 0))).toBe(1);
});

test('formatarDataBR mostra o mesmo dia que o banco', () => {
  expect(formatarDataBR(API)).toBe('23/11/2026');
  expect(formatarDataBR('2026-12-01')).toBe('01/12/2026');
});

test('valores vazios não quebram', () => {
  expect(dataLocal(null)).toBeNull();
  expect(dataLocal(undefined)).toBeNull();
  expect(dataLocal('')).toBeNull();
  expect(diasAte(null)).toBeNull();
  expect(formatarDataBR(null)).toBe('');
  expect(dataLocal('lixo')).toBeNull();
});
