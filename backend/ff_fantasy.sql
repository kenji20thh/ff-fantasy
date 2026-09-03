--
-- PostgreSQL database dump
--

\restrict avH1MdesPGJoUwvHp6wUQUXrhyhpJQQesBGsojCIoaBmSmDyslVYcUsBlaVu0Jj

-- Dumped from database version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: fantasy_team_day_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_team_day_players (
    selection_id integer NOT NULL,
    player_id integer NOT NULL
);


--
-- Name: fantasy_team_day_selections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_team_day_selections (
    id integer NOT NULL,
    fantasy_team_id integer NOT NULL,
    tournament_day_id integer NOT NULL,
    captain_player_id integer
);


--
-- Name: fantasy_team_day_selections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fantasy_team_day_selections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fantasy_team_day_selections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fantasy_team_day_selections_id_seq OWNED BY public.fantasy_team_day_selections.id;


--
-- Name: fantasy_team_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_team_players (
    fantasy_team_id integer NOT NULL,
    player_id integer NOT NULL
);


--
-- Name: fantasy_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_teams (
    id integer NOT NULL,
    user_id integer NOT NULL,
    captain_player_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fantasy_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fantasy_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fantasy_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fantasy_teams_id_seq OWNED BY public.fantasy_teams.id;


--
-- Name: player_room_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_room_stats (
    room_id integer NOT NULL,
    player_id integer NOT NULL,
    kills integer DEFAULT 0 NOT NULL,
    assists integer DEFAULT 0 NOT NULL,
    first_blood boolean DEFAULT false NOT NULL,
    placement integer NOT NULL
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id integer NOT NULL,
    team_id integer NOT NULL,
    nickname character varying(100) NOT NULL,
    picture_url text
);


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id integer NOT NULL,
    tournament_day_id integer NOT NULL,
    room_number integer NOT NULL
);


--
-- Name: rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rooms_id_seq OWNED BY public.rooms.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    logo_url text
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: tournament_day_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_day_teams (
    tournament_day_id integer NOT NULL,
    team_id integer NOT NULL
);


--
-- Name: tournament_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_days (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    deadline_at timestamp with time zone,
    name character varying(255) NOT NULL
);


--
-- Name: tournament_days_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournament_days_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournament_days_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournament_days_id_seq OWNED BY public.tournament_days.id;


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id integer NOT NULL,
    name text NOT NULL,
    start_date date,
    end_date date
);


--
-- Name: tournaments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournaments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournaments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournaments_id_seq OWNED BY public.tournaments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: fantasy_team_day_selections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_selections ALTER COLUMN id SET DEFAULT nextval('public.fantasy_team_day_selections_id_seq'::regclass);


--
-- Name: fantasy_teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams ALTER COLUMN id SET DEFAULT nextval('public.fantasy_teams_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms ALTER COLUMN id SET DEFAULT nextval('public.rooms_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: tournament_days id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_days ALTER COLUMN id SET DEFAULT nextval('public.tournament_days_id_seq'::regclass);


--
-- Name: tournaments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: fantasy_team_day_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fantasy_team_day_players (selection_id, player_id) FROM stdin;
1	59
1	85
1	64
1	68
2	40
2	51
2	84
2	77
4	15
4	24
4	82
4	89
5	2
5	51
5	9
5	56
\.


--
-- Data for Name: fantasy_team_day_selections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fantasy_team_day_selections (id, fantasy_team_id, tournament_day_id, captain_player_id) FROM stdin;
1	16	1	\N
2	15	1	51
4	15	3	24
5	15	4	51
\.


--
-- Data for Name: fantasy_team_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fantasy_team_players (fantasy_team_id, player_id) FROM stdin;
15	6
15	40
15	51
15	27
16	59
16	85
16	64
16	68
\.


--
-- Data for Name: fantasy_teams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fantasy_teams (id, user_id, captain_player_id, created_at) FROM stdin;
15	9	6	2026-09-03 12:55:57.278401+01
16	10	59	2026-09-03 17:51:18.365064+01
\.


--
-- Data for Name: player_room_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.player_room_stats (room_id, player_id, kills, assists, first_blood, placement) FROM stdin;
1	1	5	2	f	1
13	6	6	1	t	2
13	40	6	0	f	1
13	51	6	0	f	10
16	6	5	0	f	1
16	40	3	0	f	2
\.


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.players (id, team_id, nickname, picture_url) FROM stdin;
1	1	AMMAR	\N
2	1	YA7YAWY	\N
3	1	BRBRX21	\N
4	1	BIGBOSS	\N
5	1	BLACK	\N
6	2	ALITAOX	\N
7	2	BOHATER	\N
8	2	EVAN	\N
9	2	LMECH	\N
10	2	J SINNER	\N
11	3	BEBOO	\N
12	3	BOYKA	\N
13	3	R3DXX7	\N
14	3	TROJ4N	\N
15	3	ABDOOW	\N
16	4	PAW	\N
17	4	MADANIX	\N
18	4	BRUSS	\N
19	4	DIAE7	\N
20	4	BAYOU7	\N
21	5	VICTOR	\N
22	5	LEOOOO	\N
23	5	M7MD	\N
24	5	PEDRI	\N
25	5	SAMM	\N
26	6	DOMIN	\N
27	6	REDX	\N
28	6	XELOR11	\N
29	6	LEONIMO	\N
30	6	YUNESS	\N
31	7	TADLAOUI	\N
32	7	AMINE	\N
33	7	AYSAR	\N
34	7	C4ASPER10	\N
35	7	ZEEX	\N
36	8	YASSER	\N
37	8	SIFOX	\N
38	8	SIMOX	\N
39	8	REMIND	\N
40	8	HAWK	\N
41	9	SPE7Dx	\N
42	9	PALMER777	\N
43	9	LATIF	\N
44	9	7ARBIIIN1	\N
45	9	VENOMILY	\N
46	10	YUNES	\N
47	10	STAY	\N
48	10	ZIKO	\N
49	10	3SBY	\N
50	10	CROCO	\N
51	11	SAIT4AMA	\N
52	11	SYAZ	\N
53	11	NEGAN	\N
54	11	DOWLY	\N
55	11	BAWS	\N
56	12	STOURA	\N
57	12	MADI7	\N
58	12	YSF	\N
59	12	JOHN	\N
60	12	LOKO	\N
61	13	G18	\N
62	13	ADAM	\N
63	13	WINNER	\N
64	13	LIGHT	\N
65	13	KAS7	\N
66	14	FISHNO	\N
67	14	KSH MLK	\N
68	14	KILLER	\N
69	14	SENSEI	\N
70	14	SHIKO	\N
71	15	JERRY7	\N
72	15	HITHAM	\N
73	15	MUTEZZ	\N
74	15	MOHAB7X	\N
75	15	AHMED	\N
76	16	PERUZX	\N
77	16	LBEHJAAA	\N
78	16	ZACK	\N
79	16	POKIIX	\N
80	16	SKYITOO	\N
81	17	GUTS	\N
82	17	CHL7	\N
83	17	GARAX	\N
84	17	PAPAYN	\N
85	17	BR7	\N
86	18	SPAMv7	\N
87	18	FASTu	\N
88	18	NIPO	\N
89	18	NADIE	\N
90	18	LUANK1NG	\N
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rooms (id, tournament_day_id, room_number) FROM stdin;
1	1	1
2	1	2
3	1	3
4	1	4
5	1	5
6	1	6
7	3	1
8	3	2
9	3	3
10	3	4
11	3	5
12	3	6
13	5	1
14	5	2
15	5	3
16	5	4
17	5	5
18	5	6
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.teams (id, name, logo_url) FROM stdin;
1	JOKO FORCE	\N
3	7C ESPORTS	\N
4	BAZ ESPORTS	\N
5	DNA	\N
6	CLEAR VISION	\N
7	NEXE ESPORTS	\N
8	AL AHLI ESPORTS	\N
9	ALLIANCE	\N
10	UNKNOWN	\N
11	HUNTERS	\N
12	REDS ESPORTS	\N
13	MCA ESPORTS	\N
14	JUST STRONG	\N
15	HELL ESPORTS	\N
16	XPROJEKT ESPORTS	\N
17	SUPER STARS	\N
18	WANTED DZ	\N
2	WASK	\N
\.


--
-- Data for Name: tournament_day_teams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_day_teams (tournament_day_id, team_id) FROM stdin;
1	7
1	8
1	9
1	10
1	11
1	12
1	13
1	14
1	15
1	16
1	17
1	18
3	1
3	2
3	3
3	4
3	5
3	6
3	13
3	14
3	15
3	16
3	17
3	18
4	1
4	2
4	3
4	4
4	5
4	6
4	7
4	8
4	9
4	10
4	11
4	12
5	13
5	6
5	4
5	10
5	2
5	8
5	16
5	12
5	5
5	9
5	11
5	14
\.


--
-- Data for Name: tournament_days; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournament_days (id, tournament_id, deadline_at, name) FROM stdin;
1	1	2026-09-04 17:00:00+01	Week2 Day1 BxC
3	1	2026-09-05 17:00:00+01	Week2 Day2 AxC
4	1	2026-09-06 17:00:00+01	Week2 Day3 AxB
5	1	2026-03-09 17:00:00+00	Week1 Day3 AxC
\.


--
-- Data for Name: tournaments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournaments (id, name, start_date, end_date) FROM stdin;
1	FFWS MENA FALL 2026	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, email, password_hash, role) FROM stdin;
7	testadmin	testadmin@test.com	$2a$10$sziTsirP6cc3BKjtBkZ67utnwwqPkJ93QCqfOnhtQMglWCnse7BB6	admin
9	testuser	testuser@test.com	$2a$10$iXUy.aYNDOVmwm2i8lFa3OqB3YHgn6hib7kD8QdiSd3eRsTAvBrWa	user
10	testuser2	testuser2@test.com	$2a$10$KyQ24mPgco3ynPWqulT4HO2yNlFAmCDx5vCPA5HSz6WXT65BdcxKa	user
\.


--
-- Name: fantasy_team_day_selections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fantasy_team_day_selections_id_seq', 5, true);


--
-- Name: fantasy_teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fantasy_teams_id_seq', 16, true);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.players_id_seq', 90, true);


--
-- Name: rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rooms_id_seq', 18, true);


--
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.teams_id_seq', 18, true);


--
-- Name: tournament_days_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tournament_days_id_seq', 5, true);


--
-- Name: tournaments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tournaments_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 10, true);


--
-- Name: fantasy_team_day_players fantasy_team_day_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_players
    ADD CONSTRAINT fantasy_team_day_players_pkey PRIMARY KEY (selection_id, player_id);


--
-- Name: fantasy_team_day_selections fantasy_team_day_selections_fantasy_team_id_tournament_day__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_selections
    ADD CONSTRAINT fantasy_team_day_selections_fantasy_team_id_tournament_day__key UNIQUE (fantasy_team_id, tournament_day_id);


--
-- Name: fantasy_team_day_selections fantasy_team_day_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_selections
    ADD CONSTRAINT fantasy_team_day_selections_pkey PRIMARY KEY (id);


--
-- Name: fantasy_team_players fantasy_team_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_players
    ADD CONSTRAINT fantasy_team_players_pkey PRIMARY KEY (fantasy_team_id, player_id);


--
-- Name: fantasy_teams fantasy_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_pkey PRIMARY KEY (id);


--
-- Name: fantasy_teams fantasy_teams_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_user_id_key UNIQUE (user_id);


--
-- Name: fantasy_teams fantasy_teams_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_user_id_unique UNIQUE (user_id);


--
-- Name: player_room_stats player_room_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_room_stats
    ADD CONSTRAINT player_room_stats_pkey PRIMARY KEY (room_id, player_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_tournament_day_id_room_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_tournament_day_id_room_number_key UNIQUE (tournament_day_id, room_number);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: tournament_day_teams tournament_day_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_day_teams
    ADD CONSTRAINT tournament_day_teams_pkey PRIMARY KEY (tournament_day_id, team_id);


--
-- Name: tournament_days tournament_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_days
    ADD CONSTRAINT tournament_days_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: fantasy_team_day_players fantasy_team_day_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_players
    ADD CONSTRAINT fantasy_team_day_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: fantasy_team_day_players fantasy_team_day_players_selection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_players
    ADD CONSTRAINT fantasy_team_day_players_selection_id_fkey FOREIGN KEY (selection_id) REFERENCES public.fantasy_team_day_selections(id) ON DELETE CASCADE;


--
-- Name: fantasy_team_day_selections fantasy_team_day_selections_captain_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_selections
    ADD CONSTRAINT fantasy_team_day_selections_captain_player_id_fkey FOREIGN KEY (captain_player_id) REFERENCES public.players(id);


--
-- Name: fantasy_team_day_selections fantasy_team_day_selections_fantasy_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_selections
    ADD CONSTRAINT fantasy_team_day_selections_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id) ON DELETE CASCADE;


--
-- Name: fantasy_team_day_selections fantasy_team_day_selections_tournament_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_day_selections
    ADD CONSTRAINT fantasy_team_day_selections_tournament_day_id_fkey FOREIGN KEY (tournament_day_id) REFERENCES public.tournament_days(id) ON DELETE CASCADE;


--
-- Name: fantasy_team_players fantasy_team_players_fantasy_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_players
    ADD CONSTRAINT fantasy_team_players_fantasy_team_id_fkey FOREIGN KEY (fantasy_team_id) REFERENCES public.fantasy_teams(id);


--
-- Name: fantasy_team_players fantasy_team_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_team_players
    ADD CONSTRAINT fantasy_team_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: fantasy_teams fantasy_teams_captain_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_captain_player_id_fkey FOREIGN KEY (captain_player_id) REFERENCES public.players(id);


--
-- Name: fantasy_teams fantasy_teams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_teams
    ADD CONSTRAINT fantasy_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: player_room_stats player_room_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_room_stats
    ADD CONSTRAINT player_room_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: player_room_stats player_room_stats_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_room_stats
    ADD CONSTRAINT player_room_stats_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: players players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: rooms rooms_tournament_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_tournament_day_id_fkey FOREIGN KEY (tournament_day_id) REFERENCES public.tournament_days(id) ON DELETE CASCADE;


--
-- Name: tournament_day_teams tournament_day_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_day_teams
    ADD CONSTRAINT tournament_day_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: tournament_day_teams tournament_day_teams_tournament_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_day_teams
    ADD CONSTRAINT tournament_day_teams_tournament_day_id_fkey FOREIGN KEY (tournament_day_id) REFERENCES public.tournament_days(id) ON DELETE CASCADE;


--
-- Name: tournament_days tournament_days_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_days
    ADD CONSTRAINT tournament_days_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id);


--
-- PostgreSQL database dump complete
--

\unrestrict avH1MdesPGJoUwvHp6wUQUXrhyhpJQQesBGsojCIoaBmSmDyslVYcUsBlaVu0Jj

