import { faAngleUp, faSort } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ReactElement, useEffect, useRef, useState } from "react"
import LocationListItem from "./LocationListItem"

const LocationsTab = ({
    mangaPath,
    currentLink,
    setCurrentLink,
}: {
    mangaPath: string
    currentLink: string
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>
}): ReactElement => {
    const [locations, setLocations] = useState<string[]>([])
    const [isLoadingFile, setIsLoadingFile] = useState(true)
    const [filter, setfilter] = useState<string>("")
    const inputRef = useRef<HTMLInputElement>(null)
    const displayList = (link: string): void => {
        if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory()) {
            setIsLoadingFile(true)
            window.fs.readdir(link, (err, files) => {
                if (err) return console.error(err)
                const dirNames: string[] = files
                console.log(link)
                if (inputRef.current) {
                    inputRef.current.value = ""
                }
                setIsLoadingFile(false)
                setLocations(dirNames)
                // .map(e=>window.path.join(currentLink,e))
            })
        }
    }
    useEffect(() => {
        //    inputRef.current?.addEventListener('change',(e)=>{})
    }, [])
    useEffect(() => {
        displayList(currentLink)
        setfilter("")
    }, [currentLink])
    return (
        <div className="contTab" id="locationTab">
            <h2>
                Location
                <button data-tooltip="Sort" tabIndex={-1}>
                    <FontAwesomeIcon icon={faSort} />
                </button>
            </h2>
            <div className="tool">
                <button
                    tabIndex={-1}
                    onClick={() => {
                        setCurrentLink(link => window.path.dirname(link))
                    }}>
                    <FontAwesomeIcon icon={faAngleUp} />
                </button>
                <input
                    type="text"
                    ref={inputRef}
                    id="locationInput"
                    placeholder="Type to Search"
                    spellCheck="false"
                    title="Type to Search"
                    data-tooltip="Type to Search"
                    tabIndex={-1}
                    onChange={e => {
                        const val = e.target.value
                        let filter = ""
                        for (let i = 0; i < val.length; i++) {
                            filter += val[i] + ".*"
                        }
                        setfilter(filter)
                    }}
                />
            </div>
            <div className="location-cont">
                {isLoadingFile ? (
                    <p>Loading...</p>
                ) : locations.length === 0 ? (
                    <p>No Items</p>
                ) : (
                    <ol>
                        {locations.map(e => {
                            if (new RegExp(filter, "ig").test(e))
                                return (
                                    <LocationListItem
                                        name={e}
                                        link={window.path.join(currentLink, e)}
                                        inHistory={false}
                                        key={e}
                                        setCurrentLink={setCurrentLink}
                                    />
                                )
                        })}
                    </ol>
                )}
            </div>
        </div>
    )
}

export default LocationsTab
