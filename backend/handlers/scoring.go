package handlers

import "ff-fantasy/scoring"

func CalculatePlayerPoints(
	kills int,
	assists int,
	firstBlood bool,
	placement int,
	isCaptain bool,
) int {
	points := scoring.PlayerRoomPoints(
		kills,
		assists,
		firstBlood,
		placement,
	)

	if isCaptain {
		points *= 2
	}

	return points
}
