function syntaxCheck(_content) {
  return { valid: true };
}

function compile(_content) {
  return String.raw`
    % Front face
    \coordinate (A) at (0,0);
    \coordinate (B) at (1,0);
    \coordinate (C) at (1,1);
    \coordinate (D) at (0,1);

    % Back face (offset)
    \coordinate (E) at (0.4,0.4);
    \coordinate (F) at (1.4,0.4);
    \coordinate (G) at (1.4,1.4);
    \coordinate (H) at (0.4,1.4);

    % Dashed hidden edges
    \draw[dashed] (A) -- (E);
    \draw[dashed] (E) -- (F);
    \draw[dashed] (E) -- (H);

    % Solid edges
    \draw (A) -- (B) -- (C) -- (D) -- cycle;
    \draw (B) -- (F);
    \draw (C) -- (G);
    \draw (D) -- (H);
    \draw (F) -- (G) -- (H);
    \draw (F) -- (G);
`;
}

export default [{ prefix: "cuboid:", syntaxCheck, compile }];
