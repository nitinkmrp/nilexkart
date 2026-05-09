import Select from 'react-select';

const customStyles = {
    control: (provided) => ({
        ...provided,
        backgroundColor: "#0f3460",
        color: "white",
        borderRadius: "5px",
        border: "none",
        boxShadow: "none",
        width: "200px",
        height: "40px",
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? "#0f3460" : "white",
        color: state.isSelected ? "white" : "#0f3460",
        "&:hover": {
        backgroundColor: "#0f3460",
        color: "white",
        },
    }),
    singleValue: (provided) => ({
        ...provided,
        color: "white",
    }),
};

const FilterSelect = ({setFilterList, products}) => {
    const uniqueCategories = [...new Set(products?.map(p => p.category))].filter(Boolean);
    const options = uniqueCategories.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));

    const handleChange = (selectedOption)=> {
        if (!selectedOption || selectedOption.value === "") {
            setFilterList(products);
        } else {
            setFilterList(products.filter(item => item.category === selectedOption.value));
        }
    }
    return (
    <Select
    options={options}
    defaultValue={{ value: "", label: "Filter By Category" }}
    styles={customStyles}
    onChange={handleChange}
    />
    );
};

export default FilterSelect;
