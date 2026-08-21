function possessive(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

/** "Kate's on the list now" / "Kate and Mum are on the list" / etc. */
export function presenceText(people, myId) {
  const others = people.filter((p) => p.connected && p.id !== myId).map((p) => p.name);
  if (others.length === 0) return 'Just you on the list';
  if (others.length === 1) return `${possessive(others[0])} on the list now`;
  if (others.length === 2) return `${others[0]} and ${others[1]} are on the list`;
  return `${others[0]}, ${others[1]} and ${others.length - 2} more are on the list`;
}
