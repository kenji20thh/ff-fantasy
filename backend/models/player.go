package models

type Player struct {
	ID         int    `json:"id"`
	TeamID     int    `json:"team_id"`
	Nickname   string `json:"nickname"`
	PictureURL string `json:"picture_url"`
}

type PlayerRanking struct {
	PlayerID   int    `json:"player_id"`
	Nickname   string `json:"nickname"`
	PictureURL string `json:"picture_url"`
	TeamID     int    `json:"team_id"`
	TeamName   string `json:"team_name"`
	Kills      int    `json:"kills"`
	Points     int    `json:"points"`
}
