import bcrypt from "bcryptjs";

export async function hashPassword(password) {
  // bcryptjs is pure JS; sufficient for this challenge.
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

