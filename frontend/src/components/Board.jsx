export default function Board({ board, onDropCell, disabled }) {
  if (!board) return null;

  const rows = board.length;
  const cols = (board[0] && board[0].length) || 7;

  const handleCellClick = (c) => {
    const colFull = disabled || (board[0] && board[0][c] != null);
    if (colFull) return;
    onDropCell(c);
  };

  return (
    <div className="board">
      <div className="grid" role="grid" aria-label="game board">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`row-${r}`} className="row" role="row">
            {Array.from({ length: cols }).map((_, c) => {
              const v = board[r][c] ?? null;
              const cls = v === "X" ? "disc x" : v === "O" ? "disc o" : "disc";

              const clickable = !disabled && board[0][c] == null;

              return (
                <div
                  key={`cell-${r}-${c}`}
                  className={`cell ${clickable ? "clickable" : ""}`}
                  onClick={clickable ? () => handleCellClick(c) : undefined}
                  role={clickable ? "button" : "presentation"}
                  tabIndex={clickable ? 0 : -1}
                  title={clickable ? `Drop in column ${c + 1}` : undefined}
                  aria-label={clickable ? `cell ${r + 1}-${c + 1}` : undefined}
                >
                  <div className={cls}></div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
