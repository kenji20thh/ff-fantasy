package models

type Player struct {
	ID       int    `json:"id"`
	TeamID   int    `json:"team_id"`
	Nickname string `json:"nickname"`
}
