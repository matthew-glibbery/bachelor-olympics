import { describe, expect, it } from "vitest";
import { settleOverallBets } from "./settleOverallBets";

const standings = [
  { playerId: "p1", adjusted: 500 },
  { playerId: "p2", adjusted: 450 },
  { playerId: "p3", adjusted: 400 },
  { playerId: "p4", adjusted: 350 },
];

describe("settleOverallBets", () => {
  it("wins a 'win' bet on the actual leader", () => {
    const [result] = settleOverallBets(
      [{ id: "b1", betType: "win", pickPlayerId: "p1", switches: 0 }],
      standings,
    );
    expect(result).toEqual({ id: "b1", status: "won", payout: 100 });
  });

  it("loses a 'win' bet on anyone but the leader", () => {
    const [result] = settleOverallBets(
      [{ id: "b1", betType: "win", pickPlayerId: "p2", switches: 0 }],
      standings,
    );
    expect(result).toEqual({ id: "b1", status: "lost", payout: 0 });
  });

  it("wins a 'top3' bet for anyone in the top 3, not just the leader", () => {
    const [result] = settleOverallBets(
      [{ id: "b1", betType: "top3", pickPlayerId: "p3", switches: 0 }],
      standings,
    );
    expect(result).toEqual({ id: "b1", status: "won", payout: 20 });
  });

  it("loses a 'top3' bet for someone outside the top 3", () => {
    const [result] = settleOverallBets(
      [{ id: "b1", betType: "top3", pickPlayerId: "p4", switches: 0 }],
      standings,
    );
    expect(result?.status).toBe("lost");
  });

  it("halves the payout per switch on a winning bet", () => {
    const [result] = settleOverallBets(
      [{ id: "b1", betType: "win", pickPlayerId: "p1", switches: 2 }],
      standings,
    );
    expect(result?.payout).toBe(25);
  });

  it("treats an exact tie for 1st as a win for either tied player", () => {
    const tied = [
      { playerId: "a", adjusted: 500 },
      { playerId: "b", adjusted: 500 },
      { playerId: "c", adjusted: 300 },
    ];
    const results = settleOverallBets(
      [
        { id: "b1", betType: "win", pickPlayerId: "a", switches: 0 },
        { id: "b2", betType: "win", pickPlayerId: "b", switches: 0 },
      ],
      tied,
    );
    expect(results.every((r) => r.status === "won")).toBe(true);
  });

  it("a tie for 3rd doesn't bump the 4th-place tied player into the top3", () => {
    // Two players tied at rank 3 (both above a lone 4th-ranked player at a
    // strictly lower score) — standard competition ranking: 1,2,3,3, next
    // rank is 5, not 4.
    const tied = [
      { playerId: "p1", adjusted: 500 },
      { playerId: "p2", adjusted: 450 },
      { playerId: "p3", adjusted: 400 },
      { playerId: "p4", adjusted: 400 },
      { playerId: "p5", adjusted: 300 },
    ];
    const results = settleOverallBets(
      [
        { id: "b1", betType: "top3", pickPlayerId: "p4", switches: 0 },
        { id: "b2", betType: "top3", pickPlayerId: "p5", switches: 0 },
      ],
      tied,
    );
    expect(results.find((r) => r.id === "b1")?.status).toBe("won");
    expect(results.find((r) => r.id === "b2")?.status).toBe("lost");
  });

  it("loses if the pick isn't in the final standings at all", () => {
    const [result] = settleOverallBets(
      [{ id: "b1", betType: "win", pickPlayerId: "ghost", switches: 0 }],
      standings,
    );
    expect(result).toEqual({ id: "b1", status: "lost", payout: 0 });
  });
});
