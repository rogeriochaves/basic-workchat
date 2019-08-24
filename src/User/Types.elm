module User.Types exposing (Model, Msg(..), User)

import RemoteData exposing (..)


type alias Model =
    { user : WebData User
    }


type alias User =
    { id : String
    , name : String
    }


type Msg
    = NoOp
    | LoadedUser (WebData User)
