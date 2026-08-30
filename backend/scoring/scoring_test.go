package scoring

import "testing"

func TestPlayerRoomPoints(t *testing.T) {
	points := PlayerRoomPoints(3, 2, true, 2)

	if points != 57 {
		t.Fatalf("expected 57 points, got %d", points)
	}
}

func TestPlacementPoints(t *testing.T) {
	tests := []struct {
		placement int
		expected  int
	}{
		{1, 15},
		{2, 12},
		{3, 10},
		{4, 8},
		{5, 6},
		{6, 5},
		{7, 4},
		{8, 3},
		{9, 2},
		{10, 1},
		{11, 0},
		{12, 0},
	}

	for _, test := range tests {
		got := PlacementPoints(test.placement)

		if got != test.expected {
			t.Fatalf(
				"placement %d: expected %d, got %d",
				test.placement,
				test.expected,
				got,
			)
		}
	}
}

func TestFantasyTeamPoints(t *testing.T) {
	scores := []PlayerScore{
		{PlayerID: 1, Points: 57, IsCaptain: true},
		{PlayerID: 2, Points: 30, IsCaptain: false},
		{PlayerID: 3, Points: 42, IsCaptain: false},
		{PlayerID: 4, Points: 25, IsCaptain: false},
	}

	got := FantasyTeamPoints(scores)

	if got != 211 {
		t.Fatalf("expected 211 points, got %d", got)
	}
}
