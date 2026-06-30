"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { IconBackspaceFilled, IconCheckFilled } from "@tabler/icons-react"

export default function Keypad() {
    const [pin, setPin] = useState("")
    const maxLength = 6

    const handlePress = (value: string) => {
        if (pin.length < maxLength) {
            setPin((prev) => prev + value)
        }
    }

    const handleDelete = () => {
        setPin((prev) => prev.slice(0, -1))
    }

    const handleClear = () => {
        setPin("")
    }

    const handleSubmit = () => {
        alert(`Submitted PIN: ${pin}`)
    }

    return (
        <div className="flex flex-col items-center gap-6 p-6 bg-background border rounded-lg shadow-sm max-w-sm mx-auto">
            {/* Display */}
            <div className="w-full max-w-xs">
                <Input
                    type="password"
                    value={pin}
                    readOnly
                    className="text-center text-2xl tracking-widest bg-muted/40 font-mono"
                    placeholder="Enter PIN"
                />
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button
                        key={num}
                        variant="outline"
                        onClick={() => handlePress(num.toString())}
                        className="h-14 text-xl font-semibold rounded-full"
                    >
                        {num}
                    </Button>
                ))}

                {/* Bottom Row */}
                <Button
                    variant="ghost"
                    onClick={handleClear}
                    className="h-14 text-sm font-medium"
                >
                    Clear
                </Button>

                <Button
                    variant="outline"
                    onClick={() => handlePress("0")}
                    className="h-14 text-xl font-semibold rounded-full"
                >
                    0
                </Button>

                <Button
                    variant="ghost"
                    onClick={handleDelete}
                    className="h-14 text-destructive"
                    disabled={!pin}
                >
                    <IconBackspaceFilled className="w-5 h-5" />
                </Button>
            </div>

            {/* Submit Action */}
            {pin.length === maxLength && (
                <Button
                    onClick={handleSubmit}
                    className="w-full max-w-xs bg-primary text-primary-foreground"
                >
                    <IconCheckFilled className="w-4 h-4 mr-2" /> Verify
                </Button>
            )}
        </div>
    )
}
