/** Box ids keep the v1 shape: `box_<epoch ms>_<9 random chars>`. */
export const newBoxId = () => `box_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/** Session ids keep the v1 shape: `session_<epoch ms>`. */
export const newSessionId = (now: Date) => `session_${now.getTime()}`;
