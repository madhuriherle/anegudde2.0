import * as React from "react";
import ReactSelect from "react-select";

const SearchableSelect = React.forwardRef(({
  options,
  value,
  onChange,
  placeholder = "Search & Select Item...",
  className,
  isDisabled,
  menuPortalTarget = null,
  ...props
}, ref) => {
  // Find the selected option object matching the current value
  const selectedOption = options.find(o => Number(o.value) === Number(value)) || null;

  // Custom styling matching the temple theme variables
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: "44px", // h-11
      backgroundColor: "#FFFFFF",
      borderColor: state.isFocused ? "#C9B296" : "#E7D5C3",
      borderRadius: "0.375rem", // rounded-md
      boxShadow: state.isFocused ? "0 0 0 1px #D9C8AF" : "none",
      fontSize: "15px",
      fontFamily: '"Inter", sans-serif',
      color: "#3E2723", // text-text-main
      paddingLeft: "26px", // Shift contents to the right for the search icon
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238D6E63' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "12px center",
      "&:hover": {
        borderColor: state.isFocused ? "#C9B296" : "#C9B296",
      }
    }),
    valueContainer: (provided) => ({
      ...provided,
      padding: "0 8px",
    }),
    input: (provided) => ({
      ...provided,
      color: "#3E2723",
      fontFamily: '"Inter", sans-serif',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: "#3E2723",
      fontFamily: '"Inter", sans-serif',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: "#8D6E63", // secondary light color
      fontSize: "15px",
      fontFamily: '"Inter", sans-serif',
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: "#FFFFFF",
      border: "1px solid #E7D5C3",
      borderRadius: "0.375rem",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      zIndex: 9999,
    }),
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
    menuList: (provided) => ({
      ...provided,
      maxHeight: "250px",
      overflowY: "auto",
      "&::-webkit-scrollbar": {
        width: "6px",
      },
      "&::-webkit-scrollbar-track": {
        background: "#FAF6F0",
      },
      "&::-webkit-scrollbar-thumb": {
        background: "#C9B296",
        borderRadius: "3px",
      },
      "&::-webkit-scrollbar-thumb:hover": {
        background: "#D05E2D",
      }
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? "#D05E2D" // primary color
        : state.isFocused 
          ? "rgba(208, 94, 45, 0.1)" // soft primary tint on focus/hover
          : "#FFFFFF",
      color: state.isSelected ? "#FFFFFF" : "#3E2723",
      padding: "10px 12px",
      fontSize: "15px",
      fontFamily: '"Inter", sans-serif',
      cursor: "pointer",
      "&:active": {
        backgroundColor: "#D05E2D",
        color: "#FFFFFF"
      }
    }),
    dropdownIndicator: (provided, state) => ({
      ...provided,
      color: "#8D6E63",
      paddingRight: "12px",
      "&:hover": {
        color: "#472B20"
      }
    }),
    indicatorSeparator: () => ({
      display: "none"
    })
  };

  return (
    <ReactSelect
      ref={ref}
      options={options}
      value={selectedOption}
      onChange={(option) => {
        onChange(option ? option.value : 0);
      }}
      placeholder={placeholder}
      styles={customStyles}
      menuPortalTarget={menuPortalTarget}
      isDisabled={isDisabled}
      className={className}
      isSearchable={true}
      {...props}
    />
  );
});

SearchableSelect.displayName = "SearchableSelect";

export { SearchableSelect };
