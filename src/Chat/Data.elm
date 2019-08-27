module Chat.Data exposing (decodeMessages, fetchMessages, markAsRead, sendMessage)

import Array exposing (Array, map)
import Chat.Types exposing (..)
import Dict exposing (Dict, map, toList)
import Http
import Json.Decode as Decoder exposing (Decoder, bool, field, int, list, nullable, string)
import Json.Decode.Pipeline exposing (optional, required)
import Json.Encode as Encoder
import RemoteData exposing (..)


fetchMessages : String -> Cmd Msg
fetchMessages threadId =
    let
        returnMsg =
            RemoteData.fromResult >> LoadedMessages threadId
    in
    Http.get
        { url = "/api/messages/" ++ threadId
        , expect = Http.expectJson returnMsg decodeMessages
        }


decodeMessages : Decoder.Decoder (List Message)
decodeMessages =
    Decoder.list decodeMessage


decodeMessage : Decoder.Decoder Message
decodeMessage =
    Decoder.succeed Message
        |> required "timestamp" int
        |> required "authorId" string
        |> required "message" string
        |> required "stickerId" (nullable (field "id" string))
        |> required "fileAttachments"
            (Decoder.oneOf
                [ Decoder.list
                    (Decoder.succeed Image
                        |> required "url" string
                        |> required "metadata" (field "width" int)
                        |> required "metadata" (field "height" int)
                    )
                    |> Decoder.map List.head
                , Decoder.succeed Nothing
                ]
            )


sendMessage : String -> String -> String -> Cmd Msg
sendMessage currentUserId threadId message =
    let
        returnMsg =
            RemoteData.fromResult
                >> (\res ->
                        case res of
                            Success True ->
                                MessageSent
                                    { threadId = threadId
                                    , message = message
                                    , authorId = currentUserId
                                    , timestamp = 0
                                    }

                            _ ->
                                UpdateDraft message
                   )
    in
    Http.post
        { url = "/api/messages/" ++ threadId ++ "/send"
        , body =
            Http.jsonBody
                (Encoder.object
                    [ ( "message", Encoder.string message )
                    ]
                )
        , expect = Http.expectJson returnMsg (field "succeeded" bool)
        }


markAsRead : String -> Message -> Cmd Msg
markAsRead threadId lastMessage =
    Http.post
        { url = "/api/messages/" ++ threadId ++ "/markAsRead/" ++ lastMessage.authorId
        , body = Http.emptyBody
        , expect = Http.expectJson (always NoOp) (field "succeeded" bool)
        }
