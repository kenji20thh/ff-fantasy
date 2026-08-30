package scoring

func PlacementPoints(placement int) int {
	switch placement {
	case 1:
		return 15
	case 2:
		return 12
	case 3:
		return 10
	case 4:
		return 8
	case 5:
		return 6
	case 6:
		return 5
	case 7:
		return 4
	case 8:
		return 3
	case 9:
		return 2
	case 10:
		return 1
	default:
		return 0
	}
}

func PlayerRoomPoints(kills, assists int, firstBlood bool, placement int) int {
	points := kills * 10
	points += assists * 5

	if firstBlood {
		points += 5
	}

	points += PlacementPoints(placement)

	return points
}
