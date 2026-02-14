import React from "react";

type LogoProps = {
  cell?: number;     // tamaño de cada cuadrito
  gap?: number;      // separación entre cuadritos
  letterGap?: number;// separación entre letras
  radius?: number;   // redondeo de cada cuadrito (rx/ry)
  color?: string;
  background?: string; // opcional
};

const FONT: Record<string, string[]> = {
  // 6x8 (última fila como padding)
  G: [
    "111110",
    "100000",
    "100111",
    "100001",
    "100001",
    "100001",
    "111110",
    "000000",
  ],
  R: [
    "111110",
    "100001",
    "100001",
    "111110",
    "100100",
    "100010",
    "100001",
    "000000",
  ],
  I: [
    "111111", // opción B: barra superior
    "001100",
    "001100",
    "001100",
    "001100",
    "001100",
    "111111", // barra inferior
    "000000",
  ],
  D: [
    "111100",
    "100010",
    "100001",
    "100001",
    "100001",
    "100010",
    "111100",
    "000000",
  ],
};

function renderLetter(
  letter: string,
  x0: number,
  y0: number,
  cell: number,
  gap: number,
  radius: number,
  color: string
) {
  const grid = FONT[letter];
  const rects: React.ReactNode[] = [];

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "1") {
        const px = x0 + x * (cell + gap);
        const py = y0 + y * (cell + gap);
        rects.push(
          <rect
            key={`${letter}-${x}-${y}-${x0}`}
            x={px}
            y={py}
            width={cell}
            height={cell}
            rx={radius}
            ry={radius}
            fill={color}
          />
        );
      }
    }
  }
  return rects;
}

export default function GRIDILogo({
  cell = 16,
  gap = 4,
  letterGap = 18,
  radius = 4,
  color = "#000",
  background = "transparent",
}: LogoProps) {
  const text = ["G", "R", "I", "D", "I"];

  const cols = 6;
  const rows = 8;

  const letterW = cols * cell + (cols - 1) * gap;
  const letterH = rows * cell + (rows - 1) * gap;

  const totalW = text.length * letterW + (text.length - 1) * letterGap;
  const totalH = letterH;

  let cursorX = 0;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="GRIDI logo"
      style={{ display: "block" }}
    >
      {background !== "transparent" && (
        <rect x="0" y="0" width={totalW} height={totalH} fill={background} />
      )}

      {text.flatMap((ch) => {
        const nodes = renderLetter(ch, cursorX, 0, cell, gap, radius, color);
        cursorX += letterW + letterGap;
        return nodes;
      })}
    </svg>
  );
}
